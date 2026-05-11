import 'package:flutter/foundation.dart';

import '../state/app_model.dart';

void _log(String message) {
  if (kDebugMode) {
    debugPrint('[ZoroBg] $message');
  }
}

/// Reconstructs a minimal [AppModel] inside the workmanager background isolate
/// by exercising the same disk-loading code paths the main isolate uses.
///
/// We deliberately stick with the existing [AppModel.bootstrap] flow rather than
/// a parallel "lite" model. That keeps `ScheduledAgentRunner`, the LLM client,
/// the reminder predicates, and persistence APIs identical in both isolates so
/// the foreground / background paths can never drift.
class BackgroundStateLoader {
  /// Builds the model and runs the same boot pipeline as the foreground app.
  /// Safe to call repeatedly — [AppModel.bootstrap] is idempotent per instance.
  static Future<AppModel> load() async {
    _log('load: constructing AppModel');
    final model = AppModel();
    await model.bootstrap();
    _log(
      'load: bootstrap done agents=${model.agents.length} '
      'tasks=${model.scheduledAgentTasks.length} hasKey=${model.hasAnyApiKey}',
    );
    return model;
  }
}
