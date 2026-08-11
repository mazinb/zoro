# How I Learned to Stop Talking to AI and Start Playing with It

## The Wall

Last week I asked ChatGPT to explain how a GPU memory bus works. It gave me a bulleted list with zero value. Then I asked it to *build me a diagram* and actually understood the thing for the first time in my life.

I've seen it too many times: open a chat to understand quantum computing, or chip manufacturing, or anything that actually matters. The model responds with a wall of bullet points and a few strategic 🎯 emojis. You read three paragraphs and feel like you've absorbed nothing.

It's not your fault. The problem is baked in. LLMs are trained on text and tuned by RLHF to produce helpful-sounding explanations. The next-token prediction objective has a bias toward flat lists of facts — they're easy to generate, easy to parse, and easy to forget. You get the surface. You don't get the *thing* — the actual mental model that lets you predict what happens next when you change a variable or encounter an edge case.

I kept hitting this wall until I tried something that actually worked: instead of asking an AI to explain a topic, I asked it to build something you can *play with*.

## The Chip That Changed How I Learn

[ChipTycoon](https://laurentiugabriel.github.io/blog/chip-tycoon/) is a low-poly game where you drive a cart through the entire semiconductor manufacturing process — sand collection, photolithography, etching, doping, deposition — from raw quartz to finished transistor.

I visited it. You click through the photolithography step and for five minutes you're just staring at a square of silicon getting bathed in light, and then it clicks — you actually *see* why photolithography is the bottleneck in chip manufacturing. You couldn't get that from reading a Wikipedia article. You can't get it from a bulleted list. You have to *play* it.

Here's why this matters:

**Most people have zero idea how a chip is made.** Even engineers who use chips daily. You've probably seen a CPU and thought "magic." The author took that "magic" and turned it into something you can literally drive a cart through.

**The low-poly choice is strategic.** The simulation is simplified, obviously. You need to imagine what a quartz sand pile actually looks like after it's been through a furnace. But simplicity is a feature here — it forces you to focus on the big picture first. You build intuition for the overall process before the details matter.

**The learning sticks because it's spatial.** Memory works best with visual encoding. When you remember "the part where the cart goes through the furnace," you're accessing that information through a visual memory. Those are more durable than text.

## The Method

Laurentiu Gabriel [described this approach](https://laurentiugabriel.github.io/blog/articles/how-i-use-llms-to-learn/) in detail. Here's what I actually do now:

**Build the knowledge base.** In plan mode, I use Claude Code to construct a structured knowledge base on the topic. Not an essay — facts, relationships, edge cases. This step is about accuracy, not readability.

**Review for hallucinations.** I ask the model to review its own knowledge base. "What might be wrong here? What's speculative? Where are you guessing?" This catches the most common failure mode: confident nonsense.

**Build a simulation.** This is the magic step. I ask the model to create a game-like simulation of the topic — think Rollercoaster Tycoon meets a textbook. I add UX requirements: responsive design, pause controls, playable on phone or desktop. The simulation should map concepts to visual objects and show them *changing* as you interact with them.

**Deploy and play.** I push it to a repo and enable GitHub Pages. Suddenly I'm not reading about something — I'm interacting with it.

## Why It Works

This isn't some quirky hack — it maps onto what learning research has known for a long time.

**Concrete examples beat abstract descriptions.** When you're trying to understand how a CPU fab works, reading about it is like trying to understand a magic trick by watching someone describe the box. You need to see the trick. Brown, Collins, and Duguid's classic 1989 paper on situated learning shows that knowledge embedded in a meaningful context — a simulated environment where you can act on it — sticks far better than isolated facts. A simulation puts abstract concepts into a visual format your brain can actually manipulate.

**Active recall beats passive consumption.** When something goes wrong in a simulation — you mess up the doping ratio and the whole wafer fails — your brain immediately tries to fix it. That's active recall. Dunlosky et al.'s landmark 2013 review of 700+ learning techniques found that active retrieval consistently outperformed rereading and highlighting by a wide margin, and simulations make retrieval automatic because the game won't let you move forward until you get it right.

**Mental model building.** The real goal of learning isn't memorizing facts. It's building a way of thinking about a domain that lets you make predictions. A good simulation *is* a mental model made visible. You can see how changing one thing ripples through the system. Sweller's cognitive load theory explains why: simulations let you manipulate the mental model directly instead of holding abstractions in working memory.

## This Has Already Been Proven

The "build a game to learn" pattern isn't new — the medium just changed.

The [Oregon Trail](https://en.wikipedia.org/wiki/The_Oregon_Trail_(video_game)) proved this in 1978. Kids learned about pioneer survival, geography, and resource management without realizing they were learning because they were too busy trying not to die of dysentery.

[SimCity](https://en.wikipedia.org/wiki/SimCity) was the original business and urban planning simulation. Players built cities, made budget decisions, dealt with consequences. No textbook could compete with the intuition you built from watching your own city collapse when you zoned industrial next to residential.

For physics, a simulation of orbital mechanics where you tweak a planet's mass and watch its orbit decay in real time conveys more intuition than any static diagram. For history, interactive timelines where decisions at key moments change the outcome — like the "Civilization" games make you understand geopolitical dynamics — teach causal reasoning in a way that textbooks cannot. For business, running a virtual company where pricing decisions, hiring, and inventory create cascading consequences teaches systems thinking that case studies only describe.

ChipTycoon follows the same tradition: take a domain that most people only encounter as a product, and turn it into a system they can manipulate.

## Where This Breaks Down

I should be honest about what this approach *doesn't* solve.

Philosophy, ethics, and literary analysis don't simulate well. There's no cart to drive through a fab when you're debating Rawls vs. Nozick. Some domains simply resist gamification, and forcing them into a game framework can oversimplify nuanced arguments into false dichotomies.

The practical constraints matter, too. Generating a working simulation takes time and API costs that make this impractical for casual learning. If you just need to understand a concept in five minutes, asking a chat model for a quick explanation is still the right move.

And the engagement trap is real: you can have fun playing a simulation and still not learn what you think you learned. The gap between feeling like you understand and actually understanding is one of the most persistent problems in education, and a shiny interactive experience can widen that gap if there's no mechanism for calibration — no way to check whether your intuition about the simulation maps onto reality. Accessibility matters too — simulations built with graphics and spatial reasoning can be inaccessible to visually impaired learners.

## How to Improve the Approach

Here are two improvements worth building on:

**Add 3D assets.** For the gaps where low-poly abstraction isn't enough, computer vision can convert real photos into 3D objects, then map those into the simulation. This bridges the gap between accuracy and engagement.

**Add challenges.** Turn the learning experience into a puzzle. Ask questions about previous steps. Create intuitive challenges that test whether you've actually understood the material. Learning isn't just about passive interaction — it's about being tested in a low-stakes environment.

## The Bottom Line

I'm skeptical traditional education will change fast. But the bottleneck isn't the technology — it's the insight, and the author just proved the insight works.

A completely different way of using AI: instead of asking a model to explain something, you ask it to build something you can interact with. You become the player, not the student.

If you want to learn something complex, try this: don't ask an AI to explain it. Ask it to build you a game.

---

Sources:
[1] https://laurentiugabriel.github.io/blog/articles/how-i-use-llms-to-learn/
[2] https://laurentiugabriel.github.io/blog/chip-tycoon/

Academic:
[3] Brown, Collins, and Duguid. "Situated Cognition and the Culture of Learning." Educational Researcher, 1989.
[4] Dunlosky et al. "Improving Students' Learning With Effective Learning Techniques." Psychological Science in the Public Interest, 2013.
[5] Sweller, J. "Cognitive Load During Problem Solving: Effects on Learning." Cognitive Science, 1988.
