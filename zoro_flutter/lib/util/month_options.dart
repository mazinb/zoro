class MonthOption {
  const MonthOption({required this.value, required this.label});

  final String value;
  final String label;
}

String _formatMonthYear(DateTime d) {
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  return '${months[d.month - 1]} ${d.year}';
}

List<MonthOption> recentMonths({int count = 6}) {
  final out = <MonthOption>[];
  final now = DateTime.now();
  final anchor = DateTime(now.year, now.month - 1, 1);

  for (var i = 0; i < count; i++) {
    final d = DateTime(anchor.year, anchor.month - i, 1);
    final y = d.year.toString();
    final m = d.month.toString().padLeft(2, '0');
    out.add(MonthOption(value: '$y-$m', label: _formatMonthYear(d)));
  }
  return out;
}
