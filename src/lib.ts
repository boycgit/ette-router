export enum CONTENT_TYPE {
  JSON = 'JSON',
  TEXT = 'TEXT',
  BINARY = 'BINARY'
}

export enum HTTP_METHOD {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  SUBSCRIBE = 'SUBSCRIBE'
}

export function invariant(check, message, scope = 'ette-router') {
  if (!check) {
    throw new Error(
      `${scope ? '[' + scope + ']' : ''} Invariant failed: ${message}`
    );
  }
}

/**
 * Safe decodeURIComponent, won't throw any error.
 * If `decodeURIComponent` error happen, just return the original value.
 *
 * @param {String} text
 * @returns {String} URL decode original string.
 * @private
 */

export function safeDecodeURIComponent(text: string) {
  try {
    return decodeURIComponent(text);
  } catch (e) {
    return text;
  }
}
