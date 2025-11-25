const POST_AUTH_REDIRECT_KEY = "selmaPostAuthRedirect";

export const setPostAuthRedirectTarget = (path = "/booking") => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(POST_AUTH_REDIRECT_KEY, path);
};

export const consumePostAuthRedirectTarget = () => {
  if (typeof window === "undefined") {
    return null;
  }
  const target = window.localStorage.getItem(POST_AUTH_REDIRECT_KEY);
  if (target) {
    window.localStorage.removeItem(POST_AUTH_REDIRECT_KEY);
  }
  return target;
};

export const clearPostAuthRedirectTarget = () => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(POST_AUTH_REDIRECT_KEY);
};

