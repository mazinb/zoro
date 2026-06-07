/// Disclosure for Zoro-hosted cloud AI (imports).
class CloudImportConsentInfo {
  const CloudImportConsentInfo._();

  static const displayName = 'Cloud AI';
  static const recipientName = 'Google';
  static const recipientDescription =
      'Zoro sends import data to Google\'s secure cloud AI to read statements and photos.';
  static const processingLocation =
      'Processed on Google\'s servers. Zoro does not store your statement contents.';
  static const recipientTermsUrl = 'https://developers.google.com/terms';
  static const recipientPrivacyUrl = 'https://policies.google.com/privacy';

  static const dataSent = [
    'Text extracted from PDFs or files you choose to import',
    'Photos of statements you choose to import',
    'Account names and balances already in the app (to avoid duplicates)',
  ];
}
