# Why Insurance Rating Factors Predict Claims But Don't Cause Crashes

**Mazin Biviji**

The actuaries are not wrong. They are just profoundly misleading when you tell them to explain the physics of a fender-bender.

Every major car insurance company has a rating model. These models consume demographics, vehicle information, territory, mileage, driving history, and a few other variables to spit out a premium. The models work. They predict annual claim frequency with enough precision to keep companies profitable and regulators satisfied. They work so well that insurance companies have no incentive to change them. So why should anyone care whether a rating factor causes crashes?

Because the question of causation matters far more than the question of prediction, especially when the answer reveals something uncomfortable about how risk classification actually operates in the real world.

An annual premium tells you who is going to file the most claims over the next twelve months. It does not tell you how a collision actually happens. These are different facts. They live on different time scales, they draw on different evidence, and they answer fundamentally different questions. When actuaries present a rating coefficient as if it explains why crashes happen, they are smuggling a prediction across the causal boundary without justification. The boundary is real. And Arthur Charpentier's 2026 paper on this subject makes the boundary as visible as a seatbelt reminder light blinking in your rearview mirror.

Charpentier's work builds a multiscale causal diagram framework that maps 72 study-edge records from road safety research into a coherent crash-occurrence graph [1]. His core finding is straightforward once you stare at it long enough: the mechanisms that cause collisions operate within seconds, minutes, and individual trips. Speed choices happen in the space between two heartbeats. Distraction unfolds over minutes. Fatigue accumulates across nights. The actuary's annual claim count does not see any of this. It sees a policy number, a number of claims, and a dollar amount. The temporal resolution gap is enormous. The same actuarial contrast can be compatible with many different mechanistic explanations, and no amount of statistical conditioning bridges the gap on its own.

Let me be explicit about what this means. Young drivers do not crash because they are young. They crash because they drive faster, drive more at night, carry passengers who amplify risky decisions, accumulate fewer hours of hazard recognition experience, and drive cars with less safety technology. Age is a proxy for all of those things. The insurance model compresses them into a single coefficient. The coefficient predicts claims accurately. That is its entire purpose. It is not supposed to tell you which mechanism is responsible.

## The time scale problem

Road safety researchers study crashes the way surgeons study incisions. They record speed, braking, headway, glance behavior, traffic state, weather, fatigue, distraction, passenger configuration, and a dozen other variables at a resolution that captures what happens in the moment before impact. Naturalistic driving studies mount cameras on windshields. Telematics devices log acceleration and braking to fractions of a second. Case-crossover designs compare a driver's behavior during the window before a crash to their own behavior during uneventful periods. The time scale is seconds and minutes.

Insurance actuaries study the same population from a distance. They collect data at policy inception. They update scores quarterly or annually. They observe aggregate claim counts at the end of the policy period. The time scale is months or years.

This mismatch is not a technical inconvenience. It is a structural feature of the system. Charpentier formalizes it by constructing an explicit DAG with separate layers: a structural crash-occurrence graph at the opportunity level, an actuarial observation layer that maps rating variables to latent states like accumulated experience, exposure composition, and transient behavior, and a downstream crash-to-claim process that handles reporting, responsibility attribution, and claim administration [1]. Each layer operates at a different scale. The rating coefficient is a summary of the gap between them.

The implication is uncomfortable for anyone who believes that insurance pricing is a neutral science. A tariff describes how recorded claim frequency varies with rating information. A mechanistic explanation asks which exposure, context, behavior, and vehicle pathways generate a crash contrast. These two questions only converge under assumptions that link time scale, mechanism, and claim observation. The assumptions are rarely justified.

## The bonus-malus revelation

The French motor insurance dataset known as freMTPL2freq, with nearly 677,000 policy records drawn from the CASdatasets portfolio [5], provides a striking illustration. Charpentier computes the annual claim-frequency relativity for drivers aged 18 to 20 compared to the reference group aged 40 to 49. After adjusting only for vehicle and geographic factors, the relativity sits at 3.388 [1]. Young drivers file more than three times as many claims as middle-aged drivers.

Now add bonus-malus categories to the model. The relativity collapses to 1.235.

Most people, including many actuaries, interpret this collapse as evidence that young driver risk was always about prior claims history. Bonus-malus summarizes how many claims a driver has made during their insurance career. Young drivers have shorter insurance careers and higher claim rates, so their bonus-malus scores reflect that experience gap. The model is controlling for experience. The age effect shrinks. Therefore age was never the real cause, right?

Wrong. Or at least, wrong in the way people mean when they say that.

Bonus-malus is an endogenous variable. It is constructed from prior claims history and insurance duration. It sits downstream of the very crashes and claims that the insurance company is trying to predict. Conditioning on it changes what the predictive contrast measures. It blocks parts of the historical pathway. It can induce collider-type associations among the multiple causes of the score. It does not estimate a causal effect of age. It does not estimate a causal effect of claims history. It estimates a different conditional predictive contrast.

The distinction matters because bonus-malus is a behavioral intervention disguised as a statistical control. The French system adjusts premiums based on claim experience. Good drivers get discounts. Bad drivers get surcharges. This changes how people drive. Telematics-based feedback programs confirm this [6]. Field experiments in the Netherlands showed that pay-as-you-drive insurance changed young drivers' speed choices [5]. Randomized trials confirm that financial incentives alter braking, acceleration, and overall driving behavior [6]. The insurance system does not merely observe risk. It shapes it.

When the model conditions on bonus-malus, it is comparing young drivers who have the same claim history as middle-aged drivers. That is a useful predictive contrast. It answers the question: if a young driver had the same record as a 45-year-old, what would their expected claims look like? The answer is approximately 1.2 times as many claims, not 3.4 times. But this number tells you nothing about the mechanism that actually generates the difference in raw claim frequency.

The bonus-malus-adjusted value of 1.235 is a conditional predictive contrast under the fitted model. It is not a controlled direct effect of age. It is not a deconfounded crash-risk contrast. It is not an effect among otherwise identical drivers. The model compares drivers who share a bonus-malus score, but that score is a summary of past behavior, not a randomized treatment. The people who end up with the same score at age 20 as they have at age 45 have different accumulated mileage, different route types, different traffic exposure, and different vehicle preferences. The model does not and cannot capture these differences.

## The Spanish age-mediation problem

Charpentier takes the analysis further by importing an external study into the framework. A Spanish study by Gomes-Franco and colleagues [4] used mediation analysis on police-recorded crashes to decompose the age-crash relationship. They found that the indirect effect operating through environmental and vehicle circumstances had an odds ratio of 1.09. The direct path had an odds ratio of 1.97. The total was 2.15.

The paper uses this estimate as an anchor to narrow one bookkeeping block of the compatibility set [1]. The result is instructive in its limitations. Even under the tightest transport-sensitivity assumptions, the remaining region is wide. The Gomes-Franco direct path does not separate accumulated experience, risky behavior, and other driver mechanisms. One external estimate excludes some decompositions but does not select one.

The Spanish study also illustrates the impossibility of pinning down causal pathways from aggregate data. The estimand is a culpability measure from police reports, not a crash-occurrence probability from naturalistic observation. The age bands differ from the French dataset. The population differs. The reporting culture differs. Even if you accept the study's internal validity, transporting the estimate to the French portfolio requires explicit discrepancy bounds that absorb most of what you want to learn.

This is the general problem. Road safety evidence constrains crash mechanisms. Study-to-target mappings require assumptions. Claim-observation functions are separate from the crash mechanism. A tariff can be predicted precisely while both the crash pathways and the crash-to-claim bridge behind its rating contrast remain weakly constrained.

## The mileage paradox

Consider annual mileage. More mileage means more exposure. Simple enough. But the relationship between distance driven and crashes is sublinear. Elvik's synthesis [3] documents this pattern across multiple studies. Roughly speaking, if you quadruple your mileage, you do not quadruple your crash risk. You approximately double it. This means the average risk per mile declines with mileage.

This pattern is often misread as evidence that additional mileage makes you a safer driver. It does not. The decline in risk per mile follows arithmetically from the aggregate relation and does not imply that mileage itself is protective. Route composition, time-of-day mix, traffic familiarity, accumulated experience, and unobserved heterogeneity all contribute. The naturalistic driving literature shows a robust low-mileage bias that cannot be explained by the driving-safer-with-distance hypothesis alone.

The sublinear relation constrains aggregate exposure. It tells you that the function connecting distance to crashes has a specific elasticity. It does not tell you why. The elasticity is the sum of contributions from road type, time of day, traffic conditions, experience effects, and other factors. You can measure the sum without knowing its components. That is an aggregate constraint, not an identified causal composition.

Insurance models treat mileage as an exposure adjustment. They put it in the offset. They ask what remains after mileage. The answer depends on what drives drivers with different annual mileages: urban versus rural routes, highway versus city streets, peak-hour versus off-peak, weekday versus weekend, familiar versus unfamiliar territory. The model does not see these distinctions. It sees a number.

## Why prediction is not causation

The Actuary's Issue Brief on correlation versus causation warns that a relationship observed in data does not establish that one variable causes another. The warning is routine in statistics textbooks. Actuaries repeat it in professional publications. Yet the practical gap between the warning and the practice is enormous.

When an insurer rates a policy based on age, territory, vehicle class, and claims history, the pricing department does not claim to have identified causal mechanisms. The actuaries are building predictive models. The predictive models work. The problem is what happens when the predictions are treated as causal in public discourse, in policy debates, in discrimination complaints, in academic papers that cite insurance coefficients as evidence about driver behavior.

Charpentier's framework makes the gap formal. He defines a compatibility set: the collection of all structural laws and observation mappings that could reproduce an observed insurance contrast while satisfying a retained causal graph and external road safety evidence. The set is typically large. The age relativity of 3.388 is compatible with a wide range of decompositions across experience, environment, behavior, and residual mechanisms. Adding bonus-malus conditions on an endogenous variable and changes the contrast. Adding an external study excludes some decompositions but leaves the remainder wide. No amount of predictive modeling precision shrinks the set to a point.

The framework is set-valued by design. It does not claim that the data point-identify causal mechanisms. It claims that the data impose constraints. Mileage constrains aggregate exposure. The age relativity constrains the sum of mechanism contributions. External studies constrain specific blocks. The constraints are real. They are also incomplete.

## Counterargument: the bonus-malus system works as intended

The most natural defense of the current approach runs like this: insurance is not medicine. We do not need to know the precise biological mechanism of a disease to treat it. We do not need to know the exact causal pathway from distraction to collision to price risk fairly. The bonus-malus system reduces claim frequency because it changes behavior. Young drivers learn to drive better. High-risk drivers drop coverage. The system works. The rating factors predict claims. That is all that matters.

This argument conflates two distinct justifications. The first is that rating factors predict claims accurately enough to price risk without massive adverse selection. This is true. The second is that the rating factors correspond to mechanisms through which insurance design shapes behavior. This is also true, but it is a different claim from the first.

The bonus-malus system is indeed a behavioral intervention. It provides feedback about the consequences of risky driving. It changes speed choices. It changes how many people drive. It changes when people choose to report accidents. These are real behavioral effects. The problem arises when the predictive model is interpreted as evidence about which specific mechanisms are responsible, rather than as a summary of how the pricing system itself shapes the observed outcome.

Usage-based insurance deepens this feedback loop. Telematics devices provide near-real-time feedback about speed, braking, and time of day. Field experiments show that financial incentives change driving behavior. When the pricing system observes the behavior it created, the resulting correlation is a product of the intervention, not an independent signal. This is a form of self-fulfilling prediction that is well known in econometrics but rarely discussed in actuarial science.

## The data requirement

Charpentier's conclusion is practical rather than theoretical. Sharper mechanistic inference requires observations between the policy-year predictor and the recorded claim. Trip-level context: road type, traffic density, weather conditions, passenger configuration. Transient state: fatigue, attention, distraction measured continuously rather than inferred from age or territory. Conflict and near-crash data that capture the moments before collisions. Linked crash-to-claim observations that connect police-reported events to insurance records. Telematics can supply many of these signals. It already does, for a growing subset of policies. But the mainstream rating model still operates with coarse proxies because the data infrastructure is not in place.

The observation layer also defines a direct validation target. Among policy records with the same conventional rating information, measured telematics-state distributions can be compared with those implied by the predictive measurement model. Disagreement would challenge the bridge even if the annual claim model remained predictive. Linked crash-claim data would test the downstream mapping by informing the conditional mean claim contribution per crash. Neither validation is trivial. Neither has been carried out at scale.

## The behavioral economics angle

This is fundamentally a behavioral economics story. The insurance rating system is a mechanism design problem. The insurer wants to classify risk accurately while avoiding discrimination claims and regulatory constraints. The driver responds to price signals by altering driving behavior, route choice, mileage, and even insurance coverage decisions. The resulting equilibrium produces claim patterns that reflect both the underlying heterogeneity in driver behavior and the behavioral responses to the pricing system.

The rating coefficient sits at the intersection of these forces. It is a prediction that incorporates both. It is not a clean estimate of any single causal effect. It is a reduced-form outcome of a complex system. Interpreting it as a causal coefficient is like measuring the temperature of a fever to diagnose the underlying illness. The fever tells you something is wrong. It does not tell you whether the cause is bacterial or viral.

The bonus-malus system is perhaps the most elegant example. It rewards good drivers and punishes bad ones. This incentivizes careful driving. It also means that a young driver with a perfect record will have a different premium than a young driver with a single claim, even if their underlying risk profiles are identical before the claim. The system creates path dependence. History matters. The question is whether history matters because it reveals true underlying risk or because the system itself manufactures the pattern.

## What we should stop saying

Insurance professionals should stop treating rating coefficients as evidence about crash mechanisms. This is not a criticism of actuarial work. Actuaries are not asked to identify causal mechanisms. Their models are predictive, and they excel at prediction. The problem is the language used by non-actuaries who cite rating factors as if they prove specific claims about human behavior.

Politicians proposing graduated licensing based on insurance coefficients. Advocates arguing that age-based pricing discriminates because it proxies for unmeasured factors. Researchers using insurance data to study driver behavior without acknowledging the observation layer. All of them conflate prediction with causation. Charpentier's framework gives them a vocabulary for the distinction.

The vocabulary matters because policy decisions rest on causal claims, not predictive ones. If we want to reduce crashes, we need to know which levers actually work. Speed enforcement reduces crashes. Graduated licensing reduces crashes. Vehicle safety technology reduces crashes. These are mechanisms established by temporal and experimental evidence, not by regression coefficients on annual claim counts. Insurance rating factors are useful for allocating costs. They are terrible at identifying solutions.

## Conclusion

Insurance rating factors are powerful predictors. They are not crash mechanisms. The time scale mismatch is not a minor technicality. It is a structural feature of the system that renders annual claim counts incapable of identifying the causal pathways that generate collisions. The bonus-malus system changes behavior while masquerading as a statistical control. The French portfolio demonstrates that conditioning on an endogenous history variable changes the predictive contrast without identifying a causal effect. The Spanish mediation estimate shows how quickly external evidence narrows but does not eliminate the set of compatible mechanisms. The sublinear mileage relation constrains aggregate exposure without revealing composition.

The takeaway is not that insurance models are useless. It is that they answer a different question than the one we often want them to answer. They tell us who will file claims. They do not tell us how crashes happen. If we want to understand how crashes happen, we need data that operates at the time scale where crashes happen. Trips. Minutes. Seconds. Not policy years.

Until we bridge that gap, every rating coefficient will remain a prediction. A useful one. An accurate one. A prediction nonetheless.

---

## Sources

[1] Arthur Charpentier. "From Rating Factors to Crash Mechanisms: A Multiscale Causal DAG Framework Linking Motor Insurance and Road Safety." arXiv:2608.09441, August 2026. The primary source for this article. Available at https://arxiv.org/abs/2608.09441.

[2] The Actuary (ABI). "Correlation vs. Causation: Issue Brief." July 2022. Available at https://www.actuary.org/sites/default/files/2022-07/Correlation.IB_.6.22_final.pdf. Industry guidance on the distinction between predictive associations and causal relationships in actuarial work.

[3] R. Elvik. "Driver mileage and accident involvement: a synthesis of evidence." Accident Analysis & Prevention 179, 2023. Documents the sublinear relationship between annual distance driven and accident involvement.

[4] K. Gomes-Franco et al. "Explaining the association between driver's age and the risk of causing a road crash through mediation analysis." International Journal of Environmental Research and Public Health 17(23), 2020. Spanish police-recorded crash mediation analysis used as an external anchor in Charpentier's compatibility framework.

[5] C. Dutang and A. Charpentier. CASdatasets: insurance datasets (R package). The freMTPL2freq dataset used for the French portfolio analysis.
