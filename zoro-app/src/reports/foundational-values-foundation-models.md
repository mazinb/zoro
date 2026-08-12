# Foundations Beneath the Surface

## What a medical imaging researcher secretly knows when she reaches for a foundation model

A radiologist stands in front of a workstation. She is looking at a chest CT, and a model is highlighting a nodule. The model is a foundation model, trained on billions of natural images, then adapted to radiology with a handful of examples. It flags a lesion. The radiologist trusts it, or she does not.

That trust is not technical. It is moral.

The model will never explain itself the way a human colleague can, by tracing anatomy, by referencing clinical reasoning, by saying "I am concerned because this looks like X given what we know about Y." The model produces numbers. The radiologist produces a diagnosis. Between those two acts sits a chain of human decisions, most of them invisible, all of them value-laden.

This is the hidden story of foundation models in medical imaging, and it is a story we keep telling backwards.

---

## The myth of value-free AI research

We like to pretend that science is value-free. We pretend that if we just gather enough data, train on enough parameters, and run enough evaluations, the answers will arrive unattended, as though the universe has a clean output channel we only need to tap.

This is a comforting fiction. It is also wrong.

The paper "Foundational values for foundation models" by John S. H. Baxter and Elodie Germani, accepted to MICCAI 2026's Workshop on Fairness, Regulation, and Ethics, does not tell researchers to stop using foundation models. It does not tell them to embrace them either. Instead, it asks a harder question: what are you actually doing when you decide?

The answer, according to the paper, is that every technical decision in ML for medical imaging carries a normative dimension. Choosing a dataset. Choosing an architecture. Choosing whether to fine-tune or to prompt. Choosing what to measure and what to ignore. These are not mathematical operations. They are value judgments dressed in mathematical language.

Helen Longino's work on objectivity makes this explicit. Longino argues that values play an inescapable role in science, and that objectivity does not come from eliminating values but from subjecting them to community-based transformative criticism [2]. You cannot remove values from research. You can only make them visible, argumentative, and open to revision.

The foundation model debate in medical imaging is a values debate wearing a technical costume. Until we admit that, we will keep having arguments about parameters and benchmarks when we should be having arguments about whose lives hang on the answer.

---

## The case for foundation models

Let us give the strongest version of the pro-foundation-model argument fair treatment, because it is genuinely compelling.

Foundation models learn general representations of visual structure. DINOv2, trained on natural images, has been shown to transfer surprisingly well to medical image classification tasks. Some studies find it outperforms models pre-trained specifically on medical data. That is the finding reported in the arXiv:2310.19522 paper on DINOv2 transfer to medical imaging [4]. If a model trained on cats and cars and kitchen scenes can diagnose pulmonary nodules better than a model trained on chest X-rays, then there is something powerful about those general representations.

The reasoning is seductive. Medical imaging data is scarce, annotated poorly, and unevenly distributed. Why train from scratch when you can leverage representations that already understand edges, textures, spatial relationships, and the deeper structure of visual scenes? The argument runs: general-purpose learning is more efficient than domain-specific learning, especially when the domain is small.

There is a philosophical underpinning here as well. The underdetermination thesis, advanced by Longino and Heather Battaly, holds that inductive underdetermination means ML algorithms must be value-laden. When you choose what to train on, how to evaluate, which baseline to beat, you are always making choices that the data alone cannot justify. If you accept that thesis, then the question is never whether values enter the picture. The question is which values, and whose values, get to enter.

Proponents of foundation models argue, fairly, that the values they bring generalization, breadth, and the capacity to discover patterns that narrow training misses. They argue that efficiency in data-scarce domains is itself a moral good, because it means more hospitals can run better models with fewer resources. They argue that a model that sees the world broadly may be safer than one that sees it narrowly and confuses edge cases.

All of this is true. None of it is value-neutral.

Efficiency is a value. Generalization is a value. The belief that breadth is preferable to depth is a value. The choice to transfer from natural images is a value judgment about what counts as relevant training signal. Every single one of these choices would look different in a researcher trained in a different philosophical tradition or working in a different healthcare system.

---

## The case against foundation models

Now let us give the opposing view its strongest version, because it is equally compelling.

A foundation model trained on natural images brings biases that have nothing to do with medicine. Those biases are baked into the representations. The model learned patterns about light and shadow and texture and object co-occurrence from a dataset that may not reflect the demographics, equipment, or clinical practices of the hospital it is deployed in. When it transfers poorly, it does not fail uniformly. It fails in ways that correlate with race, geography, skin tone, and device type.

The paper by Baxter and Germani emphasizes the medical imaging context precisely because the stakes are different. Value choices in a recommender system are annoying. Value choices in a diagnostic model are lethal. The bias literature is clear on this. A systematic review of bias in AI medical imaging (PMC11880872) documents how systematic errors in diagnostic AI disproportionately affect marginalized patient groups [3]. When a foundation model learns that certain skin tones correlate with certain features in its natural-image training data, and then applies those patterns to dermatology, the result is not an interesting artifact. It is medical harm.

Those who argue against foundation models also point to interpretability. A radiologist can be asked, "Why did you call this malignant?" She may not always have a perfect answer, but the chain of reasoning exists. A foundation model's chain does not, at least not in any form that a human can follow. In a high-stakes domain like medicine, the ability to explain a decision is not a nice-to-have. It is a requirement of ethical practice.

There is a deeper philosophical objection here as well. Medical imaging is not about pattern matching. It is about evidence-based reasoning within a clinical context. A foundation model that transfers from natural images may have captured visual regularities, but it has not captured medical reality. It has not learned what a pulmonary nodule means for a patient's prognosis. It has not learned the difference between a artifact and a lesion in a way that connects to treatment. Using it as a diagnostic tool confuses statistical correlation with clinical meaning.

Again, all of this is true. None of it is neutral.

The belief that interpretability matters more than accuracy is a value. The belief that failing on rare groups is morally worse than failing uniformly is a value. The belief that clinical meaning requires more than pattern recognition is a value. The choice to demand domain-specific training reflects a value about what counts as legitimate knowledge.

---

## Why the Socratic approach matters

Most papers in this space pick a side and fight. This paper does something more useful. It uses a Socratic approach, asking structured critical questions rather than delivering conclusions. The method forces readers through both sides of the debate, exposing the values that each side takes for granted.

Consider a concrete case. A research team in Kenya wants to build a diagnostic tool for detecting diabetic retinopathy. They have access to a foundation model pre-trained on ImageNet. They could fine-tune it on a small dataset of retinal scans. Or they could train a model from scratch on Kenyan hospital data. The Socratic approach asks: Who benefits from choosing the foundation model approach? Who pays when it fails? What does "accuracy" mean when the test set comes from a hospital in Boston and the deployment site is a clinic in Nairobi? When you benchmark against AUC, whose AUC counts?

Socratic questioning works because it disrupts the assumption that one of these positions is the "default." The default is always someone's values. When a lab uses a foundation model, the default is the value of generalization over specificity. When a lab refuses one, the default is the value of domain fidelity over breadth. Neither is wrong. Both are choices.

The paper applies the underdetermination thesis to this specific context, showing that no amount of benchmarking will resolve the debate, because benchmarking itself is value-laden. The metrics you choose encode values. The test sets you select encode values. The baselines you compare against encode values. This is Longino's argument applied to machine learning, and it is devastatingly clear.

---

## The medical stakes

Let us be blunt. In medical imaging, value choices are not philosophical exercises. They are life and death.

A model trained on data from wealthy hospitals with expensive scanners will perform differently than a model trained on data from rural clinics with older equipment. A model fine-tuned on a homogeneous dataset will fail differently than one trained on a diverse population. A model that is a black box will cause harm differently than one that can be inspected.

These are not technical problems waiting for better algorithms. They are value problems demanding better conversations.

The bias review (PMC11880872) documents the reality. Systematic errors in AI medical imaging do not affect everyone equally. They affect marginalized groups more. The foundation model debate is not about whether these effects matter. Everyone agrees they matter. The debate is about what to do about it, and the answers depend on values, not metrics.

When a hospital deploys a foundation model for diagnostic imaging, the decision-maker is saying, "I trust generalization more than domain specificity," or "I trust accuracy more than interpretability," or "I trust efficiency more than safety." None of these are wrong statements. They are just not neutral ones.

---

## The antidote

The antidote to blind adoption or reflexive rejection of foundation models is not better benchmarks. It is explicit values.

Researchers need to say what they value, clearly and publicly. If you choose a foundation model because generalization matters more than interpretability, say that. If you refuse a foundation model because domain fidelity matters more than accuracy, say that. If you fine-tune on a particular dataset, explain whose data it represents and whose it excludes. If you use a natural-domain pre-trained model, explain the value judgment that made you believe natural-image patterns are relevant to medical diagnosis.

Objectivity, in Longino's framework, does not come from having no values. It comes from having values that are visible, argumentative, and subject to revision through community criticism. A research program that says "our approach is objective" is either lying or ignorant. A research program that says "we value X over Y, and here is why, and we welcome criticism" is doing science properly.

This requires institutional change. Journals should require value statements alongside method sections. Funding agencies should reward transparency about value trade-offs, not just performance numbers. Conferences should create space for philosophical debate alongside technical presentations. And researchers, individually, should stop using technical language to disguise moral decisions.

---

## What this means for the field

The foundation model debate will not end with a benchmark result. No model will win an AUC and settle the question, because the question is not which model performs best. The question is what performance means, for whom, under what conditions, and at what cost.

The Socratic approach of Baxter and Germani's paper is a model for how to continue this conversation. Ask better questions. Expose the values behind the methods. Make the trade-offs visible. Do not pretend that a technical choice is value-free.

Medical imaging AI is not a technical problem. It is a moral one that happens to involve deep learning. Every decision a researcher makes encodes a value. The question is whether those values are chosen consciously and argued openly, or chosen unconsciously and defended as "just the way things are done."

A radiologist trusts a model to help her diagnose a patient. That trust should be based on honest reflection about what the model can and cannot do, not on the comforting fiction that the model is "objective" or "data-driven" or "the best available approach." The model is a tool, and like all tools, it reflects the values of whoever built it and whoever chose to use it.

Make those values explicit. Argue about them. Revise them. That is how science works. That is how we keep people alive.

---

## Sources

[1] Baxter, J. S. H., & Germani, E. (2026). "Foundational values for foundation models." arXiv:2608.09377. Accepted to MICCAI 2026 Workshop on Fairness, Regulation, and Ethics (FAIMI-BRIDGE-EPIMI 2026).

[2] Longino, H. E. (2002). "Science as Social Knowledge: Values and Objectivity in Scientific Knowledge." Princeton University Press.

[3] Bias in AI medical imaging systematic review. PMC11880872.

[4] DINOv2 medical transfer paper. arXiv:2310.19522.
