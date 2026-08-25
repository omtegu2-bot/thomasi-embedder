# DEVELOPMENT HALTED
Development has been halted to focus on 2 other major projects. One will make this *much* harder to block, and the other will target the hardware that everybody should have, a calculator.


# thomasi-embedder
I like embedding things, this embeds things well.

# Mission Statement
The Thomasi-Embedder is made with the purpose of delievering a taste of the internet to those in a restricted environment like a school.
Yeah this is a pretty fun project, we like people using it, our goal is to get it working under Securly after we get a tester, improve Goguardian evade tech, and research into ways to make this work on all systems. If you can help, please commit! None of the developers even use the site for anything beyond the rare blocked wikipedia article or manga excursion or really needing super metroid in school. We will soon be adding even more content, and we intend to fix any block, and you can lead your school district all around the chain. Start from codepen and see how long they take.
If you want, just clone the project and host it somewhere, feel free to commit a message here, the more people that host the stronger any method is.
If there are requests, we can deal with them in time.
Our eventual goal is reducing javascript reliance, and odd browser issue reliance to a minimum before we get to the embedder.html page. As schools try to block JS first it is worth trying.

# Technical Details
The embedder uses a combo of iframes, soon proxies, and embeds, about:blank and other trusted contexts in order to advance into an unprotected environment.
Very shortly a launcher will be made with some following enhancements: I figured out how to load it by querying the site to give a page as a result but not actually load the page, as of such the browser isn't embedding a page, thus avoiding goguardians check, it's just rendering a page. This page then does the same thing with any requested content. So it works exactly the same it just uses really fancy slightly slower tech that then requires a backend. First embeds can be inspected, but you can't really inspect it if a whole page is just sent as is, so by sending the page as is the embed cannot be inspected, thus allowing a simple setup.\

HTML file immediantly opens a new blank tab that requests a proxy backend to give it the page, the page is a launcher, any page you try to launch is proxied and served through there. Thus there is never a URL to check and any site can be browsed like normal.\
Because of an improved internet connection and better hardware, it'll have a strong backend.\
Additionally, the launcher won't just pull 1 IP, it'll be able to pull from a large list, check if avaliable, and if not grab the next, alongside grabbing updated lists (if I can make that work), hypothetically this would allow anybody to spin up an instance and be added to a "Swarm" though the project even without this function should prove exceptionally hard to block (firewalls I guess)\
