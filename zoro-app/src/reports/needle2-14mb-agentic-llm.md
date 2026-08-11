# Needle2: 14MB LLM Proves the AI Arms Race Was Pointless

**August 11, 2026 · 12 min read**

---

A language model that fits inside a JPEG. A 45-million-parameter brain that takes up fourteen megabytes of flash storage and runs a full conversation in twenty-eight megabytes of RAM. Lives on a phone you could buy at a street stall for less than two hundred dollars (about ₹16,500 in India) in a market where the dominant device runs on a battery that lasts a day, not a week. Does not need to phone home.

We have spent the last three years building AI models that gobble tokens like a Hunger Games. Companies have been racing to train on trillions of tokens, stacking billions of parameters, building data centers that consume entire city blocks of power and water. The narrative has been simple and relentless: more is better. More parameters. More data. More compute. More money. You needed a GPU cluster to run inference. You needed a remote call to access intelligence. You needed internet connectivity to have a working assistant.

Then Cactus Compute released Needle2 and the entire paradigm cracked open.

Needle2 is a 45-million-parameter model for tool calling, device use, and structured extraction. Its whole deployment is a single 14-megabyte binary. It runs on Cortex-M microcontrollers all the way up to x86 machines and even inside WebAssembly in your browser. No GPU. No cloud API. No internet connection required. It ships as a single C++ binary with zero dependencies. You download it, run it, and it works. [1]

This is not a toy model. On the Google Mobile Actions benchmark, a strict exact-match test of whether a model can correctly invoke device functions on a smartphone, Needle2 scores 63.7 percent accuracy, trading wins with models that are five times to seventy times larger and written in full 16-bit floating point. On DroidCall, the Android intent benchmark, it beats Apple's own on-device foundation model. On BFCL v4, it outperforms FunctionGemma 270M in most categories despite having one-sixth the parameters. And it does all of this while consuming 70 megaflops per token compared to 6,000 for Apple's model or 540 for FunctionGemma. [1]

You can run Needle2 on a Raspberry Pi 5 and get 500 tokens per second of decode speed. You can run it on a Meta Quest 3S or Apple Vision Pro and hit 400 to 1,500 tokens per second. You can run it on a sub-₹16,500 Samsung A-series phone and still get 300 to 700 tokens per second. The peak session RAM is 28 megabytes. It fits on newer microcontrollers like the ESP32-S3. [1]

I have spent years covering the AI industry. I have watched companies pour billions into models that require data centers the size of aircraft hangars. I have interviewed engineers who spend more time managing GPU clusters than actually solving problems. I have seen startups build their entire business on top of API calls to models that cost pennies per thousand tokens to run, when the real cost was the infrastructure overhead that made those pennies necessary.

Needle2 is a middle finger to all of that. It is a binary the size of an email attachment that proves the AI arms race was built on a false premise. You do not need a trillion tokens to make a model that works. You do not need billions of parameters to build something useful. You need the right architecture for the right problem, and you need to design the hardware and software stack around that constraint from the very beginning.

---

## The Architecture of Constraint

The most interesting thing about Needle2 is not that it exists. Small language models have been around for years. Microsoft's Phi-2 had 2.7 billion parameters and was impressive for its time. Google's Gemma 2B was another milestone. Even the quantized model ecosystem, with projects like llama.cpp, llamafile, and TinyLLM, has been pushing the boundary of what you can run on a laptop. But Needle2 does not stop at running a small model. It builds the entire engine around the constraint of tiny hardware from scratch. That is the real innovation. Not just a small model, but an inference system that makes it *fast*.

What Needle2 does differently is go further. Farther.

At 45 million parameters, Needle2 is five times smaller than the smallest competing model it benchmarks against, LFM2.5, which was pretrained on 19 trillion tokens, roughly 120 times more tokens than Needle2's total of 153 billion. And yet the two models trade wins on benchmarks designed for mobile devices and below. [1]

How is this possible? The answer lies in the architecture, which was designed backwards from the constraints of edge devices rather than forwards from the capabilities of data center GPUs.

The first major innovation is the Hadamard MLP. In a conventional transformer, the MLP layer consists of dense up-and-down projections that mix channels. This is parameter-heavy and compute-intensive. Needle2 replaces it with a fixed Walsh-Hadamard transform, which is an orthonormal matrix applied in n log n time with zero parameters to read, combined with learned diagonal elements. The channel mixing that dominates a small model's weight budget now costs almost nothing. [1]

The second is the engram. This is Needle2's solution to the world knowledge problem. Rather than trying to compress all of human knowledge into the parameters of a 45-million-parameter network, which is mathematically impossible, Needle2 moves world knowledge into hashed n-gram tables. These are external memory structures that the model can read a few rows per token. The capacity is nearly free at decode time, which matters enormously on devices where every megabyte read from flash is latency and battery drain. The engram accounts for eight million of Needle2's parameters, but unlike the rest, these are gathered memory. They cost no arithmetic per token. [1]

The third is the multi-lane residual stream. Needle2 uses a 27-layer, 512-wide network with multiple residual lanes. This gives the network the routing flexibility of a much wider model at the cost of only a few dot products per layer rather than more attention or MLP volume. [1]

The attention mechanism is also novel. Rather than full self-attention over an unbounded context, Needle2 uses a 256-token sliding window. The KV cache is bounded no matter how long a session runs. System prompts and tool declarations are pinned as permanent sinks, so the one thing a tool-calling model must never forget, its available tools, is structurally unable to be evicted. The cache itself is trained with quantization-aware training (QAT). [1]

The memory system was designed backwards from fixed-RAM devices. The bounded session memory is what puts microcontrollers in reach. Because the sliding window caps state, Needle2's RAM is a deterministic 28-megabyte ceiling, not a curve that grows with conversation length. That fits MCU-class parts with external RAM, such as the ESP32-P4 with 32 megabytes of PSRAM, or STM32H7 and NXP i.MX RT boards with SDRAM. The engine compiles single-threaded for bare metal and ships as a static library for Cortex-M4, M7, and M55. [1]

Every architectural choice was benchmarked on the target hardware before it earned its parameters. The deliverable is not just the weights. It is the weights plus the engine, a single dependency-free C++ binary that probes the CPU at startup and self-selects its kernel tier. One artifact runs from Cortex-M to x86 to WebAssembly. There is nothing to install and nothing to download. [1]

---

## The Inference Engine: Speed Through Subtraction

The real genius of Needle2 is in the inference engine, which earns its speed from what it refuses to compute.

In conventional inference, weights are stored quantized but decompressed into RAM during execution. Needle2 never decompresses weights into RAM. The 2-bit codes are expanded inside vector registers, fused into integer dot products. The arithmetic path is int8 end to end, including activations, the KV cache, and the lane routing tables. Resident memory stays at blob size. [1]

The grammar compiler is the crown jewel. Needle2 is designed for function calling and structured extraction. Every tool declaration is compiled into a byte-level grammar that constrains every token generated by the model. But the grammar is not just a guarantee of correct output. It is an optimization. The matcher knows which tokens are legal before the logits even exist. The engine computes output scores only for candidate rows, skipping up to 98 percent of the vocabulary projection on structural tokens. On steps whose output is already forced, the grammar skips projection entirely. [1]

One universal binary probes the CPU at startup and self-selects its kernel tier: SDOT, NEON, AVX2, RISC-V vectors, WebAssembly SIMD, or scalar. The thread pool spins through the short serial sections of a token instead of sleeping, which alone nearly doubled decode speed. None of this changes a single output. Every trick is either exact or validated token for token against the reference path. [1]

The efficiency math is where Needle2 really separates itself from the quantized model crowd. A conventional transformer of Needle2's width and depth spends 164 megaflops per token. A transformer squeezed down to Needle2's parameter count still spends 87. LFM2.5 at 230 million parameters spends 460. FunctionGemma 270M spends 540, dominated by its output head, which alone is 170 million parameters of a 262-kilobyte token embedding table. Apple's on-device foundation model, at roughly 3 billion parameters, spends approximately 6,000 megaflops per token. Needle2 spends 70. [1]

Even on a high-end phone, an always-on assistant lives inside a power budget. Every megaflop is milliwatt-hours. Needle2 spends 7x to 85x fewer megaflops per token than the models it is benchmarked against. This is what battery life is made of. [1]

Moving a byte out of flash or DRAM costs orders of magnitude more energy than a multiply-accumulate operation. The budget that matters on edge silicon is FLOPs per token and bytes per token together. Needle2 cuts both. The architecture cuts FLOPs. The engine cuts bytes. Nothing rematerializes. Decoding a token reads at most the 14-megabyte blob once, and on structural tokens meaningfully less. [1]

---

## The Benchmarks: Trading Wins at a Fraction of the Size

Needle2 beats FunctionGemma 270M by 15.6 points on the BFCL v4 benchmark despite having one-sixth the parameters. That gap is not noise. The overall score is 61.7 versus 46.1, with a well-formed output rate of 95.0 percent versus 93.4 percent. Needle2 was not trained for general function calling, yet it wins in most categories. [1]

The evaluation covers five public function-calling benchmarks: Google's Mobile Actions, DroidCall, the Seal-Tools in-domain and out-of-domain tests, and BFCL v4 single-turn. Scoring is ordered strict exact match. A row passes only if the function names, the call order, and every argument value match exactly. [1]

All Needle2 numbers are measured end-to-end through the shipped C++ engine in its production configuration: CQ2-bit weights, tool retrieval on, and the 256-token sliding KV window. Nothing is relaxed for benchmarking. The numbers reflect the exact engine a device runs, window eviction included. Baselines run the released checkpoints under vLLM at full context, and Apple FM runs on-device. [1]

Two asymmetries make this comparison hard, and Cactus Compute states both upfront. First, precision: the baselines stay at f16 deliberately, because conventional post-training quantization to 2 bits collapses models that were never trained for aggressive compression. Cactus Quants is baked into Needle's training from the ground up. That skew favors the baselines. Second, scope: Needle is trained specifically for agentic tool calling and nothing else, while every baseline is a general language model carrying chat, prose, and world knowledge alongside its tool calling. That skew favors Needle. There is no clean way to level both at once. [1]

On Google's Mobile Actions benchmark (961 rows), Needle2 scores 63.7 percent accuracy, compared to 69.1 for LFM2.5-230M, 64.0 for FunctionGemma-270M, and 57.6 for Apple FM. Needle2 leads the non-empty call rate at 98.3 percent and the 2-call accuracy at 48.4 percent. On DroidCall (200 rows), Needle2 leads overall accuracy at 21.5 percent. [1]

On Seal-Tools in-domain, Needle2 achieves 26.9 percent on 4+-call rows, beating FunctionGemma's 14.6 percent. On the out-of-domain test, where entire tool domains are held out of training, Needle2 achieves 15.6 percent on 4+-call rows, again well ahead of FunctionGemma's 9.8 percent. [1]

On BFCL v4 (3,641 rows), Needle2 leads in most categories. On Python simple calls, it scores 86.8 percent, compared to FunctionGemma's 85.5 percent, despite FunctionGemma being six times larger and trained specifically for this task. On multiple calls, Needle2 scores 84.0 percent versus FunctionGemma's 78.5 percent. On live simple calls, 70.5 versus 45.0. The overall score is 61.7 for Needle2 versus 46.1 for FunctionGemma, with a well-formed rate of 95.0 percent versus 93.4 percent. Needle2 was not trained for general function calling. Its corpus is consumer device actions: smart home, mobile, wearables, TV, car, plus structured extraction. BFCL's general-purpose and enterprise API surfaces, including Java and JavaScript SDK categories, sit entirely outside that distribution. Needle2 extrapolates nonetheless. [1]

Needle2 keeps a 93.4 percent well-formed rate across all 3,641 BFCL rows. The gap concentrates where its training data has never been: Java, JavaScript, and the parallel multi-call categories. But that is exactly the point. Needle2 was not designed for enterprise APIs or SDK integration. It was designed for consumer device actions, and on that task, it competes with models dozens of times its size. [1]

These exact qualities, from consumer-device focus and no-cloud operation to sub-₹16,500 hardware and offline capability, make India the natural testbed. The Indian smartphone market is the world's second-largest by volume, with 450 million users and an average selling price far below the global average. Where global AI has been building models that assume GPU clusters, fast networks, and premium hardware, Needle2's entire design philosophy was built for the exact constraints that define India's device ecosystem. The gap between where the industry was going and where India's devices actually are is the space Needle2 was built to fill.

---

## What a 45-Million-Parameter Model Can't Do (And Why That Matters

Here is the honest truth about Needle2: it is not a general-purpose language model. It is a scalpel, not a hammer. A scalpel does not beat a hammer in a nail-driving contest. But neither does a hammer make a good eye surgeon.

Needle2 was designed for one job, mapping messy natural language to typed function calls on small devices, and it will not apologize for that narrowness. It will not write poetry. It will not reason through a complex mathematical proof. It will not summarize a 50-page research paper. It cannot translate languages fluently. It cannot hold a coherent multi-turn conversation about philosophy. These are not bugs. They are design choices. A model that spends all of its parameters on mapping messy natural language to typed function calls simply does not have capacity for creative writing.

Now consider the counterargument that should make any AI researcher uncomfortable. Maybe the arms race was necessary after all. General-purpose models like GPT-4, Claude, and Gemini have proven that society actually depends on models that can write emails, draft code, answer complex questions, and reason through novel problems. Needle2 is a proof of concept for a narrow vertical. It does not compete with Claude. It does not replace GPT. The industry's investment in general-purpose AI is not vanity, it is a response to real demand. Maybe Needle2's narrow focus is just a footnote, a clever hack for a tiny market that will always be a sliver of the total AI addressable space.

The response to that counterargument is simple: Needle2 does not need to replace Claude to matter. It needs to serve the 80 percent of devices that exist outside the general-purpose model's universe. Roughly four in five edge devices cost under $200. Over 21 billion connected IoT devices exist in the world, compared to roughly 1.5 billion PCs. Needle2 is designed for that universe. The counterargument confuses the size of an addressable market with the importance of a use case. GPS was not designed to replace computers. It was designed to answer a simpler question: where am I? Needle2 is answering a similarly specific question with equal confidence.

The 256-token sliding window is another constraint. After 256 tokens of context, older tokens are evicted. For a voice assistant that responds to \"turn on the living room light,\" this is fine. For a chatbot that needs to remember the entire conversation, it is not. The pinned system prompt and tool declarations solve the tool-calling problem permanently, but general conversation context is finite. [1]

The engram, while clever, is still an approximation. Hashed n-gram tables store world knowledge as compressed patterns, not as rich semantic embeddings. The model can retrieve facts, but it will not have the depth or nuance of a model that has internalized knowledge through billions of forward passes through a massive dense network. [1]

The strict exact match evaluation protocol is both a strength and a limitation. Needle2 scores are measured with unforgiving precision. A single wrong argument value or wrong call order means the row fails. This is rigorous and honest. But it also means Needle2 may perform better in casual, real-world usage where a model that gets 80 percent of the arguments correct is still useful, even if it fails strict exact match. [1]

Post-training quantization for the baselines creates an asymmetry. Cactus Quants was trained into Needle2 from the very beginning. The 2-bit model deployed is the model that was trained. If the baselines were also trained at CQ2-bit from pretrain, the gap would likely narrow. Cactus Compute acknowledges this, which is honest. [1]

Finally, Needle2 is optimized for consumer device actions. If your use case is enterprise API calling, multi-step scientific reasoning, or creative content generation, you need a different model. Needle2 is a scalpel, not a hammer. And that is fine, as long as you understand what tool you are holding. [1]

---

## The Indian Edge: Why This Matters for the World's Biggest Smartphone Market

India has 450 million smartphone users, and the majority of them use budget devices under ₹16,500 (roughly $200). This is not a side market. This is the dominant market. India is the second-largest smartphone market in the world by volume, and the average selling price of a smartphone in India is significantly below the global average. [1]

The Indian smartphone market is the world's largest test case for the AI industry's great unresolved question: can useful AI actually work on the devices people already own? Not flagships. Not premium mid-rangers. The ₹10,000 to ₹15,000 phones that dominate sales charts. Models that require cloud APIs and large language models that need GPU acceleration are inaccessible to most Indian smartphone users. Needle2 changes that equation. [1]

India has 300 million IoT connections and is growing rapidly. The UPI ecosystem proved that India can build world-class digital infrastructure at scale. Paytm, PhonePe, Google Pay, and the UPI infrastructure that processes billions of transactions daily were built on the principle that technology should work on the devices that people already have, not on the devices that tech companies wish people had. Needle2 is the AI equivalent of UPI. [1]

Offline capability is the make-or-break feature for India, where connectivity is unreliable in rural areas and congested in urban areas. An AI assistant that runs entirely on-device, that works when the network is down, that does not require data connectivity to function, is not a luxury. In a country where millions of users have already learned that cloud AI is a privilege reserved for those with stable broadband and thick wallets, offline AI is the difference between adoption and abandonment. [1]

India's robotics sector is growing. Startups are building agricultural robots, delivery robots, and industrial automation systems. A 45-million-parameter model that can control devices, call functions, and reason about structured outputs, running on microcontrollers or low-power boards, is exactly the kind of AI infrastructure that Indian robotics companies need. [1]

Consider a farmer in Maharashtra who speaks in Marathi and wants to check soil moisture data from his IoT sensors, translate it to simple advice, and have a local language voice assistant explain what to do. Needle2, running locally on a low-cost phone, can handle this end to end. No cloud dependency. No language model that requires expensive GPUs. No API that costs money per request. Just a phone, a battery, and a model that fits in 14 megabytes. [1]

The fine-tuning capability matters just as much. A 45-million-parameter model can be retrained on a Mac or PC in minutes to hours. An Indian startup could fine-tune Needle2 on regional languages, local device APIs, and domain-specific tools without needing cloud compute or expensive GPU rental. This opens the door to India-made AI assistants that work on any phone, in any language, on any budget device. [1]

The Pebble case study is instructive. Pebble, the pioneer of modern wearables that raised $100 million on Kickstarter and was later acquired by Fitbit, runs Needle2 locally in the Index 01 app to turn spoken requests into actions without depending on a network connection. The Index Ring has no screen. When you speak to it, the action just has to happen, every time, with or without internet. That is the future of AI on edge devices. And it is a future that includes India's 450 million smartphone users. [1]

---

## The Bigger Picture: AI for the Eighty Percent

Apple Intelligence represents one vision of on-device AI. It works on Apple Silicon. It is integrated into the iOS ecosystem. It is polished and well-designed. But it is also Apple only. It requires a recent iPhone or Mac. It is a premium product for premium devices. Needle2 is the opposite. [1]

Apple FM scores 57.6 percent on Mobile Actions. Needle2 scores 63.7 percent, at a fraction of the size, running on devices that cost a fraction of an iPhone. Apple's model spends approximately 6,000 megaflops per token. Needle2 spends 70. The difference is not incremental. It is an order of magnitude. [1]

The AI industry has been building for the twenty percent. The twenty percent with expensive phones, reliable internet, and access to cloud APIs. The twenty percent in Silicon Valley, Shenzhen, and Bangalore tech parks. Needle2 is for the eighty percent. The eighty percent who buy phones on installment plans. Who share devices. Who live in areas where the network is intermittent. Who need AI that works with the hardware they have, not the hardware they wish they had. [1]

This is not a niche use case. Roughly four in five edge devices cost under $200. Over 21 billion connected IoT devices exist in the world, compared to roughly 1.5 billion PCs. Count budget phones, Raspberry Pis, microcontrollers, wearables, small robots like Reachy Mini, and connected home devices. The edge is mostly cheap hardware. [1]

Needle2 is Apache 2.0 licensed. The weights are on Hugging Face. The repository gets you running. This is not a closed system. It is not a walled garden. It is an open model that anyone can download, fine-tune, deploy, and modify. [1]

---

## Conclusion

Picture 450 million Indian phones, each carrying a 14-megabyte AI assistant that can control smart home devices, translate between languages, read sensor data, and take actions, all without an internet connection, all running on a battery that lasts a day. No cloud bill. No remote call. No GPU cluster. Just a phone, a model, and a billion simple requests processed in real time.

That future is here. The AI arms race is still turning. Trillion-parameter models are still being discussed. The hype cycle is still moving. But Needle2 proves something that the industry is going to have to face: there is another path. A path that does not require billions in funding. A path that does not require data centers. A path that works on the devices that most of the world actually uses.

The question is no longer whether AI can work on cheap hardware. It is whether the rest of the industry will bother to build for the people who actually own it.

---

## Sources

1. Cactus Compute, "Needle 2 - The 14 MB Agentic LLM for Tiny Devices," 2026. Official product page and technical documentation for Needle2, including benchmark results, architecture details, inference engine specifications, and the Pebble case study. Available at https://cactuscompute.com/needle.
