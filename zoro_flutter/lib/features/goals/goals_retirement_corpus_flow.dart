import 'package:flutter/material.dart';

import '../../core/state/app_model.dart';
import 'corpus_backtest_page.dart';

Future<void> openRetirementCorpusGuide({
  required BuildContext context,
  required AppModel model,
}) async {
  await openCorpusBacktestPage(context: context, model: model);
}
