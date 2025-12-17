use actix_web::{web, App, HttpServer, HttpResponse, Responder, post, get};
use actix_web_actors::ws;
use serde::Deserialize;
use sqlx::{SqlitePool, sqlite::SqlitePoolOptions};
use uuid::Uuid;
use argon2::{Argon2, password_hash::{SaltString, PasswordHasher, PasswordVerifier, PasswordHash}};
use rand::rngs::OsRng;
use std::collections::HashMap;
use std::sync::Mutex;
use actix::prelude::*;



// WebSocket state

struct WsState {
    sessions: Mutex<HashMap<String, Addr<MyWs>>>,
}

impl WsState {
    fn new() -> Self {
        WsState {
            sessions: Mutex::new(HashMap::new()),
        }
    }
}

// WebSocket actor

struct MyWs {
    user_id: String,
    state: web::Data<WsState>,
}

impl Actor for MyWs {
    type Context = ws::WebsocketContext<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        self.state.sessions.lock().unwrap().insert(self.user_id.clone(), ctx.address());
        println!("User {} connected via WS", self.user_id);
    }

    fn stopped(&mut self, _ctx: &mut Self::Context) {
        self.state.sessions.lock().unwrap().remove(&self.user_id);
        println!("User {} disconnected from WS", self.user_id);
    }
}

impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for MyWs {
    fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, ctx: &mut ws::WebsocketContext<Self>) {
        if let Ok(ws::Message::Text(txt)) = msg {
            println!("WS {} says: {}", self.user_id, txt);
            ctx.text(format!("Echo: {}", txt));
        }
    }
}


// Signup/Login structs

#[derive(Deserialize)]
struct SignupData {
    username: String,
    password: String,
}

#[derive(Deserialize)]
struct LoginData {
    username: String,
    password: String,
}


// Friend request struct

#[derive(Deserialize)]
struct FriendRequest {
    from_user: String,
    to_user: String,
}

// ----------------------
// Signup handler
// ----------------------
#[post("/signup")]
async fn signup(data: web::Json<SignupData>, db: web::Data<SqlitePool>) -> impl Responder {
    let exists: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM users WHERE username = ?")
        .bind(&data.username)
        .fetch_one(db.get_ref())
        .await
        .unwrap();

    if exists.0 > 0 {
        return HttpResponse::Conflict().body("Username exists. Did you mean to sign in?");
    }

    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let password_hash = argon2.hash_password(data.password.as_bytes(), &salt).unwrap().to_string();
    let id = Uuid::new_v4().to_string();

    sqlx::query("INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)")
        .bind(&id)
        .bind(&data.username)
        .bind(&password_hash)
        .execute(db.get_ref())
        .await
        .unwrap();

    HttpResponse::Ok().body(format!("Account created! Your ID: {}", id))
}

// ----------------------
// Login handler
// ----------------------
#[post("/login")]
async fn login(data: web::Json<LoginData>, db: web::Data<SqlitePool>) -> impl Responder {
    let row: Option<(String, String)> = sqlx::query_as("SELECT id, password_hash FROM users WHERE username = ?")
        .bind(&data.username)
        .fetch_optional(db.get_ref())
        .await
        .unwrap();

    match row {
        Some((user_id, stored_hash)) => {
            let parsed_hash = PasswordHash::new(&stored_hash).unwrap();
            let argon2 = Argon2::default();
            if argon2.verify_password(data.password.as_bytes(), &parsed_hash).is_ok() {
                HttpResponse::Ok().body(format!("Login success! Your ID: {}", user_id))
            } else {
                HttpResponse::Unauthorized().body("Wrong password")
            }
        }
        None => HttpResponse::NotFound().body("Username not found"),
    }
}


// Friend requests

#[post("/friend-request")]
async fn send_friend_request(data: web::Json<FriendRequest>, db: web::Data<SqlitePool>) -> impl Responder {
    sqlx::query("INSERT INTO friends (user_id, friend_id, status) VALUES (?, ?, 'pending')")
        .bind(&data.from_user)
        .bind(&data.to_user)
        .execute(db.get_ref())
        .await
        .unwrap();

    HttpResponse::Ok().body("Friend request sent!")
}

#[post("/friend-accept")]
async fn accept_friend(data: web::Json<FriendRequest>, db: web::Data<SqlitePool>) -> impl Responder {
    sqlx::query("UPDATE friends SET status = 'accepted' WHERE user_id = ? AND friend_id = ?")
        .bind(&data.from_user)
        .bind(&data.to_user)
        .execute(db.get_ref())
        .await
        .unwrap();

    sqlx::query("INSERT OR IGNORE INTO friends (user_id, friend_id, status) VALUES (?, ?, 'accepted')")
        .bind(&data.to_user)
        .bind(&data.from_user)
        .execute(db.get_ref())
        .await
        .unwrap();

    HttpResponse::Ok().body("Friend request accepted!")
}


// WebSocket route

#[get("/ws/{user_id}")]
async fn websocket_route(path: web::Path<String>, state: web::Data<WsState>, req: actix_web::HttpRequest, stream: web::Payload) -> impl Responder {
    let ws = MyWs {
        user_id: path.into_inner(),
        state,
    };
    ws::start(ws, &req, stream)
}


// Main

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let db_path = std::env::current_dir().unwrap().join("database.db");
    println!("Database path: {:?}", db_path);
    let db_url = format!("sqlite://{}", db_path.display());


    let pool: SqlitePool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await
        .expect("Failed to connect to DB");


    // Create tables
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS friends (
            user_id TEXT NOT NULL,
            friend_id TEXT NOT NULL,
            status TEXT NOT NULL,
            PRIMARY KEY(user_id, friend_id)
        );
        "#
    )
    .execute(&pool)
    .await
    .expect("Failed to create tables");

    let ws_state = web::Data::new(WsState::new());
    let db_data = web::Data::new(pool);

    println!("Server running at http://127.0.0.1:8080");

    HttpServer::new(move || {
        App::new()
            .app_data(ws_state.clone())
            .app_data(db_data.clone())
            .service(signup)
            .service(login)
            .service(send_friend_request)
            .service(accept_friend)
            .service(websocket_route)
    })
    .bind(("127.0.0.1", 8080))?
    .run()
    .await
}
