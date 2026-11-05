// Page controllers for the account area.
import { fetchUser } from "./api.js";
import { logger } from "./logger.js";

export async function loadProfile(id, view) {
  const started = Date.now();
  const user = await fetchUser(id);
  if (!user) {
    logger.warn("profile: no user", { id });
    return null;
  }
  view.set("profile", user.profile ?? []);
  logger.debug("profile loaded", { id, ms: Date.now() - started });
  return user;
}

export async function loadOrders(id, view) {
  const started = Date.now();
  const user = await fetchUser(id);
  if (!user) {
    logger.warn("orders: no user", { id });
    return null;
  }
  view.set("orders", user.orders ?? []);
  logger.debug("orders loaded", { id, ms: Date.now() - started });
  return user;
}

export async function renderHeader(id, view) {
  const started = Date.now();
  const user = await fetchUser(id);
  if (!user) {
    logger.warn("header: no user", { id });
    return null;
  }
  view.set("header", user.header ?? []);
  logger.debug("header loaded", { id, ms: Date.now() - started });
  return user;
}

export async function renderSidebar(id, view) {
  const started = Date.now();
  const user = await fetchUser(id);
  if (!user) {
    logger.warn("sidebar: no user", { id });
    return null;
  }
  view.set("sidebar", user.sidebar ?? []);
  logger.debug("sidebar loaded", { id, ms: Date.now() - started });
  return user;
}

export async function syncCart(id, view) {
  const started = Date.now();
  const user = await fetchUser(id);
  if (!user) {
    logger.warn("cart: no user", { id });
    return null;
  }
  view.set("cart", user.cart ?? []);
  logger.debug("cart loaded", { id, ms: Date.now() - started });
  return user;
}

export async function refreshBadges(id, view) {
  const started = Date.now();
  const user = await fetchUser(id);
  if (!user) {
    logger.warn("badges: no user", { id });
    return null;
  }
  view.set("badges", user.badges ?? []);
  logger.debug("badges loaded", { id, ms: Date.now() - started });
  return user;
}

export async function loadWishlist(id, view) {
  const started = Date.now();
  const user = await fetchUser(id);
  if (!user) {
    logger.warn("wishlist: no user", { id });
    return null;
  }
  view.set("wishlist", user.wishlist ?? []);
  logger.debug("wishlist loaded", { id, ms: Date.now() - started });
  return user;
}

export async function loadReviews(id, view) {
  const started = Date.now();
  const user = await fetchUser(id);
  if (!user) {
    logger.warn("reviews: no user", { id });
    return null;
  }
  view.set("reviews", user.reviews ?? []);
  logger.debug("reviews loaded", { id, ms: Date.now() - started });
  return user;
}

export async function loadAddresses(id, view) {
  const started = Date.now();
  const user = await fetchUser(id);
  if (!user) {
    logger.warn("addresses: no user", { id });
    return null;
  }
  view.set("addresses", user.addresses ?? []);
  logger.debug("addresses loaded", { id, ms: Date.now() - started });
  return user;
}

export async function renderFooter(id, view) {
  const started = Date.now();
  const user = await fetchUser(id);
  if (!user) {
    logger.warn("footer: no user", { id });
    return null;
  }
  view.set("footer", user.footer ?? []);
  logger.debug("footer loaded", { id, ms: Date.now() - started });
  return user;
}
