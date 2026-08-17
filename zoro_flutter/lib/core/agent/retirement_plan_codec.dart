/// YAML-ish frontmatter for `docs/retirement.md`. Not a full YAML parser.
class RetirementPlanDoc {
  const RetirementPlanDoc({
    required this.rev,
    this.retireBy,
    this.swrPct,
    this.investMonthly,
    required this.body,
  });

  final int rev;
  final DateTime? retireBy;
  final double? swrPct;
  final double? investMonthly;
  final String body;

  String encode() {
    final buf = StringBuffer('---\n');
    buf.writeln('id: retirement');
    buf.writeln('rev: $rev');
    if (retireBy != null) {
      buf.writeln('retire_by: ${_ymd(retireBy!)}');
    }
    if (swrPct != null) {
      buf.writeln('swr_pct: ${_num(swrPct!)}');
    }
    if (investMonthly != null) {
      buf.writeln('invest_monthly: ${_num(investMonthly!)}');
    }
    buf.writeln('---');
    buf.writeln();
    buf.write(body.trimRight());
    buf.writeln();
    return buf.toString();
  }

  static RetirementPlanDoc parse(String raw) {
    final text = raw.replaceFirst(RegExp(r'^\uFEFF'), '');
    if (!text.startsWith('---')) {
      return RetirementPlanDoc(rev: 0, body: text);
    }
    final end = text.indexOf('\n---', 3);
    if (end < 0) {
      return RetirementPlanDoc(rev: 0, body: text);
    }
    final fm = text.substring(4, end).trim();
    var body = text.substring(end + 4);
    if (body.startsWith('\n')) body = body.substring(1);
    int rev = 0;
    DateTime? retireBy;
    double? swr;
    double? invest;
    for (final line in fm.split('\n')) {
      final i = line.indexOf(':');
      if (i <= 0) continue;
      final key = line.substring(0, i).trim();
      final val = line.substring(i + 1).trim();
      switch (key) {
        case 'rev':
          rev = int.tryParse(val) ?? 0;
        case 'retire_by':
          retireBy = DateTime.tryParse(val);
        case 'swr_pct':
          swr = double.tryParse(val);
        case 'invest_monthly':
          invest = double.tryParse(val);
      }
    }
    return RetirementPlanDoc(
      rev: rev,
      retireBy: retireBy,
      swrPct: swr,
      investMonthly: invest,
      body: body,
    );
  }

  static String _ymd(DateTime d) {
    final u = d.toUtc();
    final m = u.month.toString().padLeft(2, '0');
    final day = u.day.toString().padLeft(2, '0');
    return '${u.year}-$m-$day';
  }

  static String _num(double v) {
    if (v == v.roundToDouble()) return v.round().toString();
    return v.toString();
  }
}
