// Güvenli HTML temizleme
export const sanitizeHTML = (html) => {
  if (!html) return '';
  
  return window.DOMPurify?.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    FORBID_ATTR: ['style', 'onerror', 'onload']
  }) || html.replace(/<script.*?>.*?<\/script>/gi, '');
};

// Güvenli URL kontrolü
export const isSafeUrl = (url) => {
  try {
    const parsed = new URL(url);
    const allowedHosts = [
      'drive.google.com',
      'lh3.googleusercontent.com',
      'localhost',
      '127.0.0.1'
    ];
    
    return allowedHosts.includes(parsed.hostname);
  } catch {
    return false;
  }
};