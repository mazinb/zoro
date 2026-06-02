import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/constants/community_links.dart';
import '../../core/state/app_model.dart';
import '../widgets/liquid_glass.dart';
import 'how_it_works_guides_panel.dart';
import 'tab_help_content.dart';

Future<void> openHowItWorksPage(
  BuildContext context,
  HowItWorksContent content, {
  AppModel? model,
  bool showBullets = true,
}) {
  return Navigator.of(context).push<void>(
    MaterialPageRoute(
      fullscreenDialog: true,
      builder: (ctx) => HowItWorksPage(
        content: content,
        model: model,
        showBullets: showBullets,
      ),
    ),
  );
}

class HowItWorksPage extends StatelessWidget {
  const HowItWorksPage({
    super.key,
    required this.content,
    this.model,
    this.showBullets = true,
  });

  final HowItWorksContent content;
  final AppModel? model;
  final bool showBullets;

  Future<void> _openReddit() async {
    final uri = Uri.parse(kZoroRedditCommunityUrl);
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      await launchUrl(uri, mode: LaunchMode.platformDefault);
    }
  }

  Widget _bulletPanel(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final accent = cs.primary;
    return LiquidGlassPanel(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final b in content.bullets)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('• ', style: TextStyle(color: accent, fontWeight: FontWeight.w900, fontSize: 16)),
                  Expanded(
                    child: Text(
                      b,
                      style: TextStyle(
                        color: cs.onSurface,
                        fontWeight: FontWeight.w600,
                        height: 1.4,
                        fontSize: 14,
                      ),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final accent = cs.primary;
    final m = model;

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        title: Text(content.title, style: const TextStyle(fontWeight: FontWeight.w900)),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [cs.surface, accent.withValues(alpha: 0.08)],
          ),
        ),
        child: SafeArea(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                child: m == null
                    ? ListView(
                        padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
                        children: [
                          if (showBullets) _bulletPanel(context),
                        ],
                      )
                    : ListenableBuilder(
                        listenable: m,
                        builder: (context, _) {
                          final bulletsOn = showBullets && _bulletsVisibleForContent(m, content);
                          return ListView(
                            padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
                            children: [
                              if (bulletsOn) _bulletPanel(context),
                              if (bulletsOn) const SizedBox(height: 16),
                              HowItWorksGuidesPanel(model: m),
                            ],
                          );
                        },
                      ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
                child: TextButton(
                  onPressed: _openReddit,
                  child: Text(
                    'Feedback, comments, brag, or love → Reddit',
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      color: accent,
                      decoration: TextDecoration.underline,
                      decorationColor: accent.withValues(alpha: 0.5),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

bool _bulletsVisibleForContent(AppModel model, HowItWorksContent content) {
  if (identical(content, TabHelpContent.ledger)) return model.guideEnabledLedger;
  if (identical(content, TabHelpContent.context)) return model.guideEnabledContext;
  if (identical(content, TabHelpContent.goals)) return model.guideEnabledGoals;
  if (identical(content, TabHelpContent.settings)) return model.guideEnabledSettings;
  return true;
}
