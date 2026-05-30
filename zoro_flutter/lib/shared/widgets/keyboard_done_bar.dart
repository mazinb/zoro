import 'package:flutter/material.dart';

/// Sticky bar immediately above the software keyboard with a Done action.
///
/// iOS numeric keypads have no return key; use inside a [Stack] over the page body.
class KeyboardDoneBarOverlay extends StatelessWidget {
  const KeyboardDoneBarOverlay({
    super.key,
    required this.visible,
    this.onDone,
    this.label = 'Done',
  });

  final bool visible;
  final VoidCallback? onDone;
  final String label;

  @override
  Widget build(BuildContext context) {
    if (!visible) return const SizedBox.shrink();
    final inset = MediaQuery.viewInsetsOf(context).bottom;
    if (inset <= 0) return const SizedBox.shrink();

    final cs = Theme.of(context).colorScheme;
    return Positioned(
      left: 0,
      right: 0,
      bottom: inset,
      child: Material(
        elevation: 2,
        color: cs.surfaceContainerHighest,
        child: SafeArea(
          top: false,
          child: SizedBox(
            height: 44,
            child: Row(
              children: [
                const Spacer(),
                TextButton(
                  onPressed: onDone ??
                      () => FocusManager.instance.primaryFocus?.unfocus(),
                  style: TextButton.styleFrom(
                    foregroundColor: cs.primary,
                    textStyle: const TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 16,
                    ),
                  ),
                  child: Text(label),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
