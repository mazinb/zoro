# The Souls of AI: Why Beating Dark Souls Is a More Meaningful Benchmark Than Beating Atari

**August 12, 2026 · 12 min read**

---

The gaming industry has spent years telling us that games are too easy. They added difficulty settings, accessibility options, and optional checkpoints until even the most casual player could see the credits. But there exists one game, or rather one franchise, that has stubbornly refused to bend to this trend: Dark Souls. Developed by FromSoftware and released in 2011, the game built a cult following around a single ethos, the phrase "git gud," meaning that mastery was not a feature to be toggled but a price to be paid. You learned through failure. You died. You learned more. You tried again.

Now, a new research paper called Dark Souls Learning Environment (DSLE) asks a question that feels almost perverse in its ambition: what if we used Dark Souls as a benchmark for AI intelligence [1]?

The paper, authored by Derin Gezgin, Jim O'Connor (equal contribution), Tanner Goodwin, and Gary B. Parker, was published on arXiv in August 2026 under the identifier 2608.09902v1 [1]. It introduces a containerized platform that presents all 22 boss encounters of Dark Souls: Remastered as game-playing agent benchmarks through a Gymnasium-style interface. Every environment step requires executing a real action against a running copy of the actual game. The observations are 600x800 grayscale frames of the game screen. The actions are 14 discrete button presses and mouse inputs. The reward is sparse: you either win the boss fight or you die, with a small shaped-damage bonus in between.

This is not an environment that an AI agent can brute-force through a million training steps the way it can through the Atari Learning Environment. This is an environment that, so far, no existing method has actually beaten past the tutorial boss.

And that is precisely what makes it exciting.

## Why Dark Souls, Not Atari

For over a decade, the standard benchmark for game-playing AI has been the Arcade Learning Environment (ALE), the suite of Atari 2600 games that made Deep Q-Networks famous [2]. The ALE became the proving ground for a generation of reinforcement learning research. DeepMind's DQN agent learned to play dozens of Atari games from raw pixel input [3]. OpenAI demonstrated large-scale evolutionary approaches on the same suite [4]. The games are simple: 2D sprites, limited action spaces, relatively clear objectives, and dense feedback. A player can understand what is happening on screen within a second. The AI can, too, after enough training.

The ALE was a brilliant benchmark for its era. It proved that reinforcement learning could learn from pixels. But it also proved that Atari games are too simple to distinguish between agents that genuinely reason and agents that memorize clever exploitation strategies. When an agent masters Breakout, it usually means the agent learned to track the ball and time its paddle. There is nothing wrong with that, but there is also not much room left to distinguish a clever heuristic from genuine adaptability.

Dark Souls is a different species of problem entirely. The game is an action role-playing game with a 3D perspective, complex timing, multiple simultaneous threats, environmental hazards that change during combat, and boss encounters that each require fundamentally different strategies. The Asylum Demon, the first boss, moves at a walking pace and telegraphs every swing with a wind-up animation. An agent that can dodge its hammer and strike back is not doing much more than pattern recognition on a very simple schedule.

The Capra Demon, a second-act boss, lives in what players consider the smallest arena in the game and fights alongside two dogs that rush the player the moment combat begins [1]. The agent must decide: attack the boss or kill the dogs first? Positioning matters more than reflexes here.

Ornstein and Smough, perhaps the most famous boss in the game, is a two-on-one fight where defeating one boss heals and empowers the other [1]. A naive policy that splits damage between both enemies actually makes the fight harder. The agent must learn a strategy that no human would guess at without trial and error: prioritize one target, defeat it quickly, and then face a strengthened opponent with a full heal bar.

Chaos Witch Quelaag floods her arena with lava that shrinks the safe area over time [1]. The agent must move while simultaneously attacking, constantly re-evaluating its position in a shrinking arena.

Gwyn, Lord of Cinder, the final boss, attacks at machine-gun speed with relentless sword strikes [1]. There is no room for hesitation. The agent must react in real time or die.

Bed of Chaos, meanwhile, is not a combat encounter at all. The boss cannot be killed through damage. The player must destroy two environmental targets while the floor collapses into lethal pits [1]. This is puzzle-solving under extreme time pressure.

Each boss demands qualitatively different skills: reactive timing, spatial reasoning, multi-target management, hazard navigation, objective completion, and phase-aware strategy switching. No single policy can win them all by memorization. An agent that can adapt across these encounters would need to demonstrate something resembling genuine reasoning, the ability to understand the structure of a novel situation and develop an appropriate response.

## The Experiment: What Happens When You Put RL on Dark Souls

The paper's authors set up five baseline methods to test on a representative five-boss subset they call DSLE-5: the Asylum Demon, Capra Demon, Chaos Witch Quelaag, Ornstein and Smough, and Gwyn, Lord of Cinder [1]. These bosses cover distinct pressures: tutorial melee, spatially constrained arena, environmental hazard, multi-target, and fast final-boss combat.

The five methods tested were:

1. **A random policy** that samples uniformly from the 14 discrete actions at every step.
2. **A scripted expert system** that observes game state through memory instrumentation, heals when health drops below 40%, and otherwise alternates between moving forward and attacking.
3. **PPO (Proximal Policy Optimization)**, a standard deep reinforcement learning algorithm.
4. **DQN (Deep Q-Network)**, the classic pixel-based reinforcement learning algorithm.
5. **SCOPE (Sparse Cosine Optimized Policy Evolution)**, a neuroevolutionary approach that applies a discrete cosine transform to compress visual observations before optimizing action preferences with CMA-ES.

The results were stark and, in many ways, illuminating.

On the Asylum Demon, the tutorial boss, the methods separated cleanly. The expert system won 62.8% of episodes. SCOPE won 43.0% of its best generation. PPO and DQN won under 0.33% of episodes. The random policy won nothing.

On the other four bosses, every single method registered zero wins across thousands of episodes.

Zero. Thousands of episodes, tens of hours of compute, and the agents could not beat bosses that humans can defeat on their first attempt. Not with skill, but through persistence and observation.

This is the striking finding. The authors ran a budget of 100,000 environment steps per method per boss, with five agent-side seeds each. A single run takes 6 to 15 hours for PPO and 8 to 20 hours for DQN [1]. At the default 250ms action hold time, the agent makes roughly four decisions per second of game time. The agents were not given a trivial task with insufficient compute. They were given a genuinely hard task with a realistic compute budget, and they could not solve it.

The failure modes were telling. In the cramped Capra Demon fight and the fast Gwyn fight, agents died within seconds, with median survival times between 1.7 and 6 seconds across methods [1]. This is barely enough time for an agent to land any meaningful hit. The expert system, the most sophisticated non-learning policy tested, removed less than 1% of boss health on these encounters.

In the Quelaag fight, the agents survived longer. The median survival time was 40 to 70 seconds, the longest of any boss tested. But they dealt almost no damage. The boss approaches slowly and kills the agent with lava and ranged attacks before the agent can engage in meaningful combat [1]. Long survival, zero progress.

## What It Means That an AI Cannot Beat Dark Souls

The conventional narrative in AI research is that if we just give an agent enough data, enough compute, and enough training steps, it will solve the task. Atari games seemed to confirm this. Chess was solved by brute-force search combined with handcrafted evaluation functions. Go was cracked by deep reinforcement learning paired with massive self-play [5]. Each milestone was celebrated as evidence that the approach was working, that intelligence was being built through scale.

Dark Souls suggests that scale alone might not be the answer. The agents did not fail because they lacked compute. They failed because the task structure is fundamentally different from what prior benchmarks tested. In Atari, the reward signal is dense and immediate: break a brick, gain 1 point. In Dark Souls, the reward is sparse and terminal: you die (reward of -100) or you win (reward of +10000). Between those two outcomes lies a vast ocean of unstructured failure.

The paper's authors describe this as a "near-flat, sparse reward landscape" [1]. The only signal an agent receives is a small shaped-damage bonus set against a death penalty of 100. There is nothing to climb. No gradient to follow. PPO and DQN, both gradient-based methods, produced learning curves that stayed pinned at the death floor with zero upward trend across every boss [1]. They did not get closer to a solution, even incrementally.

The evolutionary baseline, SCOPE, did slightly better. Its best-of-generation fitness climbed steadily on the Asylum boss, showing that evolutionary methods can find structure where gradient methods cannot. But even SCOPE registered kills only on the tutorial boss and flatlined on every harder encounter [1].

This raises an uncomfortable question for anyone who believes that current deep reinforcement learning methods are on the cusp of solving complex real-world tasks. If an agent trained with state-of-the-art algorithms, given 100,000 steps across five seeds, with access to full visual frames and precise game state information, cannot solve a Dark Souls boss encounter, what does that say about its ability to navigate the messy, sparse, high-stakes environments of the real world?

The previous work on Dark Souls AI used a system called DSAPI, which enabled agent interaction through screen capture and computer vision rather than direct memory access [6]. The authors trained NEAT agents to fight the Asylum Demon. That was an important demonstration that evolved policies could discover useful combat behavior in a commercial game without privileged simulator access [1]. But DSAPI relied on visual estimation of game state, required manual reset procedures, and supported only a single boss encounter. DSLE improves on this by replacing vision-based state estimation with direct memory access, enabling reliable measurement of player and boss state, automated reset through save-state swapping, headless execution, and support for distributed training.

Even with these advantages, the agents still failed. The gap between the best current methods and what would be required to beat Dark Souls is not a matter of training more steps. It is a gap in approach.

## What Beating Dark Souls Would Actually Prove

Suppose an agent defeats Ornstein and Smough. What would we have learned?

We would know that the agent can handle a two-on-one scenario where defeating one enemy strengthens the other. We would know it can make real-time tactical decisions under extreme pressure. We would know it can process 600x800 visual frames and map them to discrete motor actions at a rate of four decisions per second. These are all non-trivial capabilities.

But the deeper insight is more interesting. The agent would have demonstrated adaptive reasoning, the ability to understand a novel situation, develop a strategy, and execute it under constraints that punish hesitation. In the game, Ornstein and Smough each have distinct attack patterns, different ranges, and different damage profiles. The agent would need to learn to prioritize targets, manage its own stamina and health resources, and adjust its strategy dynamically as the fight progresses. This is the kind of reasoning that transfers to real-world robotics, autonomous navigation, and any domain where an agent must operate in complex, dynamic environments.

Compare this to beating Breakout. An agent that masters Breakout has demonstrated that it can track a ball and time its paddle. This is impressive as a proof of concept for pixel-based reinforcement learning. But it does not tell us much about the agent's ability to handle a new game with different mechanics, a different visual style, a different objective.

Dark Souls agents would have a much stronger test of adaptability. The 22 bosses in the benchmark form a built-in difficulty gradient with qualitatively different demands [1]. An agent that can handle multiple bosses would have demonstrated a range of capabilities, from reactive combat to hazard avoidance to multi-stage planning. An agent that could transfer skills learned on one boss to another would have demonstrated something resembling generalization.

The paper's authors note that several encounters outside DSLE-5 are simply not harder versions of the Asylum-style melee task. Bed of Chaos requires the player to destroy environmental targets while the arena floor collapses. Seath the Scaleless is invulnerable until the player turns away from the boss to find and destroy a crystal that regenerates on each attempt [1]. These encounters are not about reactive combat at all. They demand objective completion, target switching, and adaptation to non-stationary dynamics. Solving them would require a fundamentally different kind of intelligence.

## The Counterargument: Is This Just a Novelty?

Here is the honest criticism, and it is worth taking seriously. Dark Souls is a video game. It was designed for entertainment, not for scientific evaluation. The mechanics that make it a good benchmark are the same mechanics that make it frustrating to play. Is an agent that can defeat Dark Souls actually more intelligent than an agent that can play Atari? Or has the benchmark simply been made harder through artificial complexity?

There is a legitimate concern that solving Dark Souls does not translate to real-world capabilities. Beating a boss fight in a game with fixed mechanics, known attack patterns, and a clearly defined win condition tells us nothing about an agent's ability to handle the open-ended, poorly specified problems that matter in the real world: climate modeling, drug discovery, autonomous navigation through a city. The skills required to beat Ornstein and Smough, while genuinely impressive, might not generalize beyond the narrow domain of action role-playing games.

The computational cost is enormous. DSLE runs the unmodified Windows game inside a Docker container over Wine, with rendering provided through a virtual X11 display and DXVK translating DirectX calls to Vulkan. Each concurrent game instance uses roughly 0.3GB of GPU memory and 2 to 3GB of system RAM. A single game installation occupies about 30GB of disk. A single training run takes 6 to 20 hours of wall-clock time [1]. This is expensive. It is expensive in money, in time, and in energy. For a research community already struggling with the environmental cost of training foundation models, adding a benchmark that costs tens of hours per run seems like an indulgence.

The paper's authors acknowledge this. They recommend DSLE-5, a five-boss subset, as the starting suite for researchers [1]. They note that the cost is uneven across bosses, with encounters that end in fast deaths spending proportionally more time on resets than on agent control. They describe DSLE as "not intended to match the throughput of JAX-native environments" and designed for scalability through parallelism rather than high single-instance throughput [1].

Another concern is reproducibility. The environment is not fully deterministic. The authors ran a test where each trial executed the same set of actions against Asylum Demon across ten runs, and the trajectories diverged at step 12, terminating after 134 to 200 steps [1]. An agent can exploit early regularities in a fight, but reliable performance still requires feedback from the current episode state. This stochasticity makes it harder to establish whether a given result reflects genuine learning or a lucky run.

The game licensing is another practical barrier. DSLE requires a legally obtained copy of Dark Souls: Remastered, which the open-source artifact treats as an external dependency, following the same distribution model as StarCraft II's learning environment [1]. This means any researcher wanting to use the benchmark must own the game. The community of potential users is limited by a product that costs money and runs on Windows, not Linux.

These are all valid concerns. DSLE is not a lightweight benchmark that a graduate student can spin up in an afternoon. It is a heavyweight research platform that requires significant infrastructure investment.

But here is the thing: every meaningful benchmark in AI history has faced similar criticisms. The ALE was called toy problems. Go was called a closed game with fixed rules. AlphaGo's victory was dismissed by skeptics who argued that mastering a board game says nothing about general intelligence. The gap between "solving a game" and "being intelligent" has always been a matter of perspective, not a technical distinction.

What DSLE offers is something that Atari, ViZDoom, StarCraft II, and NetMask all lack: a benchmark that demands genuine adaptation across diverse, structurally different challenges, where no current method comes close to solving the hardest tasks, and where the gap between current performance and human-level play is measured in orders of magnitude. The benchmark is hard because the problem is genuinely hard. That is not a bug. That is the feature.

## What Comes Next

The paper's authors sketch several promising directions. They suggest methods built for sparse, long-horizon, real-time control, including model-based rollouts that amortize the high per-step cost of a real game, imitation from human demonstrations, and recurrent or transformer-based policies that track combat state across frames [1]. All of these approaches have shown promise in other domains but have not yet been applied to DSLE.

The structured layout of DSLE also enables curriculum learning. The encounters form a graded sequence and share several mechanics, such as the Asylum Demon and its later, tougher variants. Agents could be trained from easy to hard rather than on each boss in isolation. Skills learned on one fight could transfer to related ones. The difficulty of any encounter can be tuned by changing the player's health, stamina, equipment, or starting position while keeping the interface fixed, which supports controlled studies of robustness [1].

As most of the architecture of DSLE is game-agnostic, the same methodology can be applied to other Souls-like games. The benchmark could expand to include Sekiro, Elden Ring, or Bloodborne, each of which introduces different combat mechanics and new challenges. A suite of soul-like benchmarks would form one of the most demanding evaluation frameworks in AI research.

The authors' conclusion is fitting: "DSLE opens the door to a broader set of baselines and agent families because each can be evaluated through the same interface, save-state protocol, and boss suite" [1]. The door is open. It is up to the research community to walk through it.

## Why This Matters

The AI research community has spent decades looking for benchmarks that actually test intelligence rather than memorization. Atari was a start. Go was a bigger step. But both of those benchmarks have been solved, or nearly solved, by current methods. They no longer distinguish between a mediocre agent and a good one.

Dark Souls presents a benchmark where the best methods have not even reached the tutorial boss on the hardest encounters. The gap between current performance and human competence is so vast that it forces researchers to confront the limits of their approaches. It reveals that dense reward signals, clean state information, and simple action spaces are not prerequisites for intelligent behavior. They are crutches that have masked the true difficulty of the problems we care about.

DSLE is not the answer to how to build intelligent agents. It is a mirror that shows how far we have to go.

And in a field that sometimes confuses scaling parameters with scaling intelligence, a mirror might be the most useful tool of all.

---

## Sources

1. Derin Gezgin, Jim O'Connor, Tanner Goodwin, Gary B. Parker. "DSLE: A Learning Environment for Dark Souls Boss Encounters." arXiv:2608.09902v1, August 2026. Introduces the Dark Souls Learning Environment as a containerized Gymnasium-style benchmark for all 22 Dark Souls: Remastered boss encounters, with detailed experimental baselines and analysis.

2. Marcello C. Machado, Marc G. Bellemare, Erik Talvitie, Jan Veness, Michael J. Hausknecht, and Michael Bowling. "Revisiting the Arcade Learning Environment: Evaluation Protocols and Open Problems for General Agents." Journal of Artificial Intelligence Research, 2018. Comprehensive review of the ALE benchmark, its evaluation protocols, and open research problems.

3. Volodymyr Mnih, Koray Kavukcuoglu, David Silver, et al. "Human-level control through deep reinforcement learning." Nature, 2015. The seminal Deep Q-Network paper demonstrating that agents can learn to play Atari games from raw pixel input.

4. Tim Salimans, Jonathan Ho, Xi Chen, Sidor Ilya, and Sutskever Ilya. "Evolution Strategies as a Scalable Alternative to Reinforcement Learning." arXiv:1703.03864, 2017. Large-scale evolutionary approach applied to Atari, showing genetic algorithms can compete with RL methods.

5. David Silver, Julian Schrittwieser, Karen Simonyan, et al. "Mastering the game of Go without human knowledge." Nature, 2017. AlphaGo's breakthrough showing deep reinforcement learning can solve Go at a superhuman level.

6. Jim O'Connor, Gary B. Parker, and M. Bugti. "Learning Dark Souls Combat Through Pixel Input with Neuroevolution." arXiv:2507.03793, 2025. Prior work demonstrating NEAT agents can learn to fight the Asylum Demon using screen capture and computer vision.

7. FromSoftware. "Dark Souls: Remastered." Video game, 2018. The commercial game that DSLE benchmarks against.

8. Samuel Gaither and Namyong Lee. "The Dark Souls Video Game Series and the Affective Experience of Playing FromSoftware Games." Palgrave Macmillan, 2024. Academic analysis of Dark Souls as a design philosophy and its cultural impact.

9. OpenAI, Clemens Berner, Brooke Walker, et al. "Dota 2." arXiv:1912.06680, 2019. OpenAI Five's victory over world champion Dota 2 players, an example of large-scale multi-agent training in a commercial game.

10. Oriol Vinyals, Igor Babuschkin, Wojciech Czarnecki, et al. "Grandmaster level in StarCraft II using multi-agent reinforcement learning." Nature, 2019. AlphaStar's achievement in StarCraft II, another commercial game benchmark.
