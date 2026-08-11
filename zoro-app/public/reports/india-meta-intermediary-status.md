# The Algorithm That Could Delete Indian Startups

**The Indian government is asking whether a platform that shows you content is still a platform. If the answer is no, every Indian internet company is in legal trouble.**

---

Section 79 of India's Information Technology Act is the single most important law nobody in your startup boardroom has read.

It's the clause that lets Facebook host billions of posts without being sued when something illegal appears on them. The same protection applies to WhatsApp's chats, YouTube's videos, Zomato's restaurant listings. The law says platforms are "intermediaries" — like a telephone company carrying calls — not publishers responsible for what passes through them.

But here's the catch: Section 79 only applies if the platform doesn't "originate, select, transmit, or modify" content.

And every major platform in India does that now — through algorithms.

## The Recommendation Problem

When you open Facebook or Instagram or YouTube, you don't see content in chronological order. You see content that a machine learning model decided you'll care about. These models rank posts, promote videos, surface Stories. Every platform's engineering team builds these systems.

The Indian government's position was made explicit in August 2026, when the MeitY formally flagged Meta's intermediary status under the IT Act, questioning whether its recommendation algorithms — the systems that curate what users see in Facebook Reels and Instagram Stories — disqualify the company from the "intermediary" shield. The government's stance is clear: Meta must comply with Indian law, not global norms.

This matters because publishers are liable for what they publish. Intermediaries are not.

The distinction sounds technical. The consequences are not.

## What "Intermediary" Actually Means

Under the IT Act, intermediaries must follow "due diligence" requirements: appoint a compliance officer, publish terms of service, post grievance mechanisms, and take down illegal content within 72 hours of notice. If they do this, and they don't actively participate in the content, they get legal protection.

That's it.

For years, this was easy to satisfy. Facebook was a directory of user posts. The company removed content when told to. Algorithms existed but were simple — showing the newest posts first.

Then everything changed.

Today, Meta serves approximately 200 million Indians daily across Facebook and Instagram. YouTube has over 467 million users. These platforms don't just host content — they actively decide which content reaches which user. The recommendation engine is how they make money. It's also potentially how they lose legal protection.

The MeitY's draft rules and subsequent guidance have consistently suggested that platforms which "select" or "curate" content — including through automated means — may not qualify as intermediaries. The IT Rules 2021 added layers of compliance for "significant digital intermediaries," but the fundamental question remains: can an algorithmically-curated platform still claim intermediary status?

## The Telegram Paradox

Telegram faces one problem. The Indian government has repeatedly asked it to comply with due diligence — appoint a local compliance officer, verify user identities, take down illegal content. Telegram's position: it literally can't do this. Only "Secret Chats" use end-to-end encryption on Telegram; regular chats are stored on the company's servers. Even so, the platform's limited visibility into message content is far less than that of a feed curator — but the government has demanded compliance with due diligence requirements that Telegram says it can't meet.

Meta faces the opposite problem. Meta knows exactly what's in every post and every Story — because its systems analyze, categorize, and recommend them. The government's argument: by curating content through algorithms, Meta has moved beyond intermediation into active participation.

One platform gets punished for being too passive. The other gets punished for being too active.

Either way, the platforms that built India's consumer internet face potential liability for user-generated content at a scale that doesn't make financial sense.

## The Startup Math

Here's the financial reality.

A recommendation-driven startup — whether it's an e-commerce platform ranking products, a food delivery app ordering restaurants, or a content platform surfacing articles — currently operates under intermediary protection. When a user posts something problematic, the legal burden falls on the user, not the platform.

If that protection disappears:

- **Content moderation at scale**: A platform with 1 million active users posting daily would need a moderation team to review and remove illegal content within 72 hours. Independent estimates suggest compliance costs could reach ₹2-5 crore annually for a mid-sized platform — roughly $250,000–$600,000 a year.
- **Liability insurance**: Platforms would need to insure against user-generated content liability. This product doesn't really exist at scale in India, meaning companies would be operating uninsured.
- **Engineering constraints**: Recommendation systems that actively promote content would need to be rebuilt as passive chronological feeds — or abandoned entirely.
- **The relocation option**: Some platforms have already explored registering legal entities outside India, though this creates its own regulatory complications.

## What This Means for Indian Innovation

India's startup ecosystem didn't emerge because of favorable regulations. It emerged because of favorable conditions: a young population, cheap data from Jio, an angel investing diaspora, and — yes — a legal framework that allowed platforms to launch without building content moderation armies before writing their first line of code.

Section 79 played a role. So did the proliferation of affordable smartphones and the decline in data costs. But removing intermediary protection wouldn't just slow down innovation — it would fundamentally change what kind of innovation is possible in India.

Consider what disappears if recommendation systems become legally risky:
- An e-commerce platform can no longer show you products it thinks you'll buy
- A food delivery app can no longer prioritize restaurants it thinks you'll order from
- A content platform can no longer surface the articles it thinks you'll read
- A video platform can no longer play the next clip it thinks you'll watch

Each of these is just basic software functionality. But if the law says "platforms that recommend are publishers," then every piece of software that sorts, ranks, or prioritizes content becomes a legal liability.

## The Global Comparison

This isn't unique to India, but the stakes are higher here.

The United States has Section 230 of the Communications Decency Act, which explicitly states: "No provider or user of an interactive computer service shall be treated as the publisher or speaker of any information provided by another information content provider." Section 230 protects both passive hosting and active curation — platforms can moderate content without losing protection.

The European Union's Digital Services Act took a different approach. The DSA created a "Very Large Online Platform" category that triggers additional obligations — including transparency reports on algorithmic recommendations and a right for users to opt out of algorithmic curation — but crucially does not treat algorithmic curation as publishing. It recognizes that recommendation is different from hosting.

The UK's Online Safety Act takes yet another path: it doesn't distinguish based on recommendation, but instead requires platforms of all sizes to conduct risk assessments and implement content safety measures.

India has neither the clarity of Section 230 nor the nuance of the DSA. Section 79 was written in 2000, before social media existed. The IT Rules 2021 tried to fill the gap, but left the core question unanswered: does algorithmic curation disqualify intermediary status?

India has 800 million internet users — roughly a quarter of the world's online population. How India answers this question will shape not just its own startup ecosystem but serve as a model for other large, developing markets.

## The Proportional Approach

The law should distinguish between scales of involvement. A platform hosting 100 posts a day has different obligations than a platform hosting 10 million. A platform that passively displays content has different obligations than one that actively promotes it through machine learning.

But the current framework doesn't make these distinctions. It's binary: you're either an intermediary or you're not. And "intermediary" was defined in an era when platforms were directories, not recommendation engines.

A more proportional approach might look like this:
- **Passive platforms** (no curation, pure hosting) retain full intermediary protection with standard compliance
- **Curated platforms** (algorithmic ranking, user recommendation) get conditional protection with additional compliance requirements
- **Content creators** (platforms that commission or produce content) lose intermediary protection entirely

This is closer to how the DSA approaches the problem. But India is still figuring out where it stands.

## Where This Goes

As of now, the question remains open. No court has ruled on it. But the trajectory is clear.

The IT Rules have been progressively tightening. The requirement for "significant digital intermediaries" to appoint grievance officers, publish monthly compliance reports, and cooperate with law enforcement signals a regulatory posture that treats large platforms as more than passive pipes.

For every Indian startup with a recommendation engine — and by now, that's every one of them — the question isn't theoretical anymore. It's a business risk that needs to be factored into product decisions, engineering choices, and legal strategy.

That's not a policy debate. It's a product decision. And it's being made right now, in committee rooms and court filings, by people who know that whichever way it goes, the Indian internet is going to look very different in five years.
