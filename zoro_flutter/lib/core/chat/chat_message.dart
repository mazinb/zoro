/// One bubble in a chat thread (persisted locally).
class ChatMessage {
  ChatMessage({
    required this.fromUser,
    required this.text,
    DateTime? createdAt,
  }) : createdAt = createdAt ?? DateTime.now();

  final bool fromUser;
  final String text;
  final DateTime createdAt;

  ChatMessage copyWith({bool? fromUser, String? text, DateTime? createdAt}) {
    return ChatMessage(
      fromUser: fromUser ?? this.fromUser,
      text: text ?? this.text,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  Map<String, dynamic> toJson() => {
        'fromUser': fromUser,
        'text': text,
        'createdAtMs': createdAt.millisecondsSinceEpoch,
      };

  static ChatMessage? fromJson(Object? raw) {
    if (raw is! Map) return null;
    final m = Map<String, dynamic>.from(raw);
    final fromUser = m['fromUser'];
    final text = m['text']?.toString();
    if (fromUser is! bool || text == null) return null;
    final ms = m['createdAtMs'];
    final at = ms is int
        ? DateTime.fromMillisecondsSinceEpoch(ms)
        : (ms is num ? DateTime.fromMillisecondsSinceEpoch(ms.round()) : DateTime.now());
    return ChatMessage(fromUser: fromUser, text: text, createdAt: at);
  }
}
