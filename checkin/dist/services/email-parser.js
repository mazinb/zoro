"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripEmailContent = stripEmailContent;
function stripEmailContent(content) {
    let stripped = content;
    // Remove common reply markers
    const replyMarkers = [
        /^On .+ wrote:.*$/m,
        /^From:.*$/m,
        /^Sent:.*$/m,
        /^To:.*$/m,
        /^Subject:.*$/m,
        /^---.*$/m,
        /^_{10,}.*$/m,
        /^>.*$/m, // Quoted lines starting with >
    ];
    for (const marker of replyMarkers) {
        stripped = stripped.replace(marker, '');
    }
    // Remove HTML if present (for text extraction)
    stripped = stripped.replace(/<[^>]+>/g, '');
    stripped = stripped.replace(/&nbsp;/g, ' ');
    stripped = stripped.replace(/&amp;/g, '&');
    stripped = stripped.replace(/&lt;/g, '<');
    stripped = stripped.replace(/&gt;/g, '>');
    stripped = stripped.replace(/&quot;/g, '"');
    stripped = stripped.replace(/&#39;/g, "'");
    // Remove common signature patterns
    const signaturePatterns = [
        /Best regards,?.*$/is,
        /Sincerely,?.*$/is,
        /Thanks,?.*$/is,
        /Regards,?.*$/is,
        /Sent from .*$/i,
        /--\s*$/m,
    ];
    for (const pattern of signaturePatterns) {
        stripped = stripped.replace(pattern, '');
    }
    // Clean up whitespace
    stripped = stripped.trim();
    stripped = stripped.replace(/\n{3,}/g, '\n\n'); // Max 2 consecutive newlines
    return stripped;
}
//# sourceMappingURL=email-parser.js.map