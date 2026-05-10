/// Optional file excerpt attached to a user message (e.g. bank CSV text).
class ChatAttachment {
  ChatAttachment({required this.fileName, required this.textExcerpt});

  final String fileName;
  final String textExcerpt;

  Map<String, dynamic> toJson() => {
        'fileName': fileName,
        'textExcerpt': textExcerpt,
      };

  static ChatAttachment? fromJson(Object? raw) {
    if (raw is! Map) return null;
    final m = Map<String, dynamic>.from(raw);
    final n = m['fileName']?.toString();
    final t = m['textExcerpt']?.toString();
    if (n == null || t == null) return null;
    return ChatAttachment(fileName: n, textExcerpt: t);
  }
}

/// One bubble in a chat thread (persisted locally).
class ChatMessage {
  ChatMessage({
    required this.fromUser,
    required this.text,
    DateTime? createdAt,
    List<ChatAttachment>? attachments,
  })  : createdAt = createdAt ?? DateTime.now(),
        attachments = attachments ?? const [];

  final bool fromUser;
  final String text;
  final DateTime createdAt;
  final List<ChatAttachment> attachments;

  ChatMessage copyWith({
    bool? fromUser,
    String? text,
    DateTime? createdAt,
    List<ChatAttachment>? attachments,
  }) {
    return ChatMessage(
      fromUser: fromUser ?? this.fromUser,
      text: text ?? this.text,
      createdAt: createdAt ?? this.createdAt,
      attachments: attachments ?? this.attachments,
    );
  }

  Map<String, dynamic> toJson() => {
        'fromUser': fromUser,
        'text': text,
        'createdAtMs': createdAt.millisecondsSinceEpoch,
        if (attachments.isNotEmpty) 'attachments': attachments.map((a) => a.toJson()).toList(),
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
    final att = <ChatAttachment>[];
    final ar = m['attachments'];
    if (ar is List) {
      for (final e in ar) {
        final a = ChatAttachment.fromJson(e);
        if (a != null) att.add(a);
      }
    }
    return ChatMessage(fromUser: fromUser, text: text, createdAt: at, attachments: att);
  }
}
