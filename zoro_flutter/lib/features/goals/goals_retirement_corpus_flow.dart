import 'package:flutter/material.dart';

import '../../core/state/app_model.dart';
import 'goals_structured_sections.dart';

Future<void> openRetirementCorpusGuide({
  required BuildContext context,
  required AppModel model,
}) async {
  await openCorpusStructuredGuide(context: context, model: model);
}
