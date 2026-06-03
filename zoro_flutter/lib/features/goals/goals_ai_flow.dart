import 'package:flutter/material.dart';

import '../../core/state/app_model.dart';
import 'goals_helper_hub_page.dart';

/// Opens the Goals helper hub (three structured sections).
Future<void> openGoalsAiAssistant({
  required BuildContext context,
  required AppModel model,
}) async {
  model.ensureRetirementGoal();
  await openGoalsHelperHub(
    context: context,
    model: model,
  );
}
