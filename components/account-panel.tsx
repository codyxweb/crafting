'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  ArrowUpRight,
  Heart,
  LogOut,
  MapPin,
  Package,
  Plus,
  ShoppingBag,
  UserRound,
  X,
} from 'lucide-react';
import styles from './account-panel.module.css';

type AccountUser = { id: string; name: string; email: string; role: string };
type Address = {
  id: string;
  name: string;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};
type Order = {
  id: string;
  number: string;
  status: string;
  total: number;
  createdAt: string;
  items: { id: string; name: string; quantity: number; product?: { images?: { url: string }[] } }[];
  shipping?: { trackingNumber?: string | null; trackingUrl?: string | null } | null;
};
type WishlistItem = {
  id: string;
  product: { id: string; slug: string; name: string; price: number; images: { url: string; alt?: string | null }[] };
};
type CustomRequest = { requestId: string; craftType: string; status: string; createdAt: string; quantity: number };
type Section = 'account' | 'orders' | 'wishlist' | 'addresses' | 'custom-orders';
type Notice = { type: 'error' | 'success'; text: string };

const navigation: { id: Section; label: string; icon: typeof UserRound; href: string }[] = [
  { id: 'account', label: 'Overview', icon: UserRound, href: '/account' },
  { id: 'orders', label: 'My orders', icon: Package, href: '/account/orders' },
  { id: 'wishlist', label: 'Wishlist', icon: Heart, href: '/account/wishlist' },
  { id: 'addresses', label: 'Addresses', icon: MapPin, href: '/account/addresses' },
  { id: 'custom-orders', label: 'Custom requests', icon: ShoppingBag, href: '/account/custom-orders' },
];

const titleFor: Record<Section, string> = {
  account: 'Your account',
  orders: 'My orders',
  wishlist: 'Your wishlist',
  addresses: 'Saved addresses',
  'custom-orders': 'Custom requests',
};

const money = (minor: number) =>
  `₹${(minor / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const date = (value: string) =>
  new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));

const humanize = (value: string) =>
  value.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'We couldn’t load your account. Please try again.');
  return data as T;
}

export function AccountPanel({ section }: { section: string }) {
  const activeSection: Section = navigation.some((item) => item.id === section) ? (section as Section) : 'account';
  const [user, setUser] = useState<AccountUser | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [requests, setRequests] = useState<CustomRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setNotice(null);
    try {
      const profile = await readJson<{ user: AccountUser | null }>(await fetch('/api/auth/me', { cache: 'no-store' }));
      if (!profile.user) {
        window.location.assign('/login');
        return;
      }
      setUser(profile.user);

      if (activeSection === 'account' || activeSection === 'orders') {
        const data = await readJson<{ orders: Order[] }>(await fetch('/api/orders', { cache: 'no-store' }));
        setOrders(data.orders);
      }
      if (activeSection === 'account' || activeSection === 'wishlist') {
        const data = await readJson<{ items: WishlistItem[] }>(await fetch('/api/wishlist', { cache: 'no-store' }));
        setWishlist(data.items);
      }
      if (activeSection === 'account' || activeSection === 'addresses') {
        const data = await readJson<{ addresses: Address[] }>(await fetch('/api/addresses', { cache: 'no-store' }));
        setAddresses(data.addresses);
      }
      if (activeSection === 'account' || activeSection === 'custom-orders') {
        const data = await readJson<{ requests: CustomRequest[] }>(await fetch('/api/custom-orders', { cache: 'no-store' }));
        setRequests(data.requests);
      }
    } catch (error) {
      setNotice({
        type: 'error',
        text: error instanceof Error ? error.message : 'We couldn’t load your account. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  }, [activeSection]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addAddress(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setNotice(null);
    try {
      const body = Object.fromEntries(new FormData(form));
      const response = await fetch('/api/addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      await readJson(response);
      form.reset();
      setNotice({ type: 'success', text: 'Your new address has been saved.' });
      await load();
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  async function removeAddress(id: string) {
    setBusy(true);
    setNotice(null);
    try {
      await readJson(await fetch(`/api/addresses?id=${encodeURIComponent(id)}`, { method: 'DELETE' }));
      setAddresses((current) => current.filter((address) => address.id !== id));
      setNotice({ type: 'success', text: 'Address removed.' });
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  async function removeWishlistItem(productId: string) {
    setBusy(true);
    setNotice(null);
    try {
      await readJson(await fetch(`/api/wishlist?productId=${encodeURIComponent(productId)}`, { method: 'DELETE' }));
      setWishlist((current) => current.filter((item) => item.product.id !== productId));
      setNotice({ type: 'success', text: 'Removed from your wishlist.' });
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error('We couldn’t sign you out. Please try again.');
      window.location.assign('/login');
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Please try again.' });
      setBusy(false);
    }
  }

  const recentOrders = orders.slice(0, 3);
  const displayName = user?.name.trim().split(/\s+/)[0] || 'there';

  return (
    <section className={styles.shell} aria-busy={loading}>
      <aside className={styles.sidebar}>
        <div className={styles.profile}>
          <span className={styles.avatar} aria-hidden="true">{user?.name.slice(0, 1).toUpperCase() || 'S'}</span>
          <div className={styles.profileText}>
            <strong>{user?.name || 'Your Seyora account'}</strong>
            <span>{user?.email || 'Loading account details'}</span>
          </div>
        </div>
        <p className={styles.navLabel}>YOUR ACCOUNT</p>
        <nav className={styles.nav} aria-label="Account navigation">
          {navigation.map(({ id, label, icon: Icon, href }) => (
            <Link key={id} href={href} className={activeSection === id ? styles.navActive : styles.navLink} aria-current={activeSection === id ? 'page' : undefined}>
              <Icon size={17} strokeWidth={1.7} />
              <span>{label}</span>
              {id === 'orders' && orders.length > 0 && <small>{orders.length}</small>}
            </Link>
          ))}
        </nav>
        <button className={styles.signOut} onClick={signOut} disabled={busy}>
          <LogOut size={17} strokeWidth={1.7} /> Sign out
        </button>
        <div className={styles.helpCard}>
          <span>NEED A HAND?</span>
          <p>We’re always happy to help with an order or a little something special.</p>
          <Link href="/contact">Talk to our studio <ArrowUpRight size={14} /></Link>
        </div>
      </aside>

      <div className={styles.content}>
        <div className={styles.pageHeading}>
          <div>
            <p className={styles.eyebrow}>YOUR SEYORA STUDIO</p>
            <h1>{activeSection === 'account' ? `Lovely to see you, ${displayName}.` : titleFor[activeSection]}</h1>
            <p>{activeSection === 'account' ? 'A little place for all the things you love.' : 'The little details, all in one place.'}</p>
          </div>
          {activeSection !== 'addresses' && (
            <Link href="/shop" className={styles.shopLink}>EXPLORE THE SHOP <ArrowRight size={15} /></Link>
          )}
        </div>

        {notice && <p className={notice.type === 'error' ? styles.errorNotice : styles.successNotice} role="status">{notice.text}</p>}

        {loading ? (
          <div className={styles.loading}><span className={styles.spinner} /> Getting your account ready…</div>
        ) : (
          <>
            {activeSection === 'account' && (
              <div className={styles.dashboard}>
                <div className={styles.stats}>
                  <Link href="/account/orders" className={styles.statCard}>
                    <span className={styles.statIcon}><Package size={19} /></span>
                    <span className={styles.statLabel}>ORDERS PLACED</span>
                    <strong>{orders.length}</strong>
                    <small>View your purchases <ArrowRight size={13} /></small>
                  </Link>
                  <Link href="/account/wishlist" className={styles.statCard}>
                    <span className={styles.statIcon}><Heart size={19} /></span>
                    <span className={styles.statLabel}>SAVED PIECES</span>
                    <strong>{wishlist.length}</strong>
                    <small>Things you love <ArrowRight size={13} /></small>
                  </Link>
                  <Link href="/account/addresses" className={styles.statCard}>
                    <span className={styles.statIcon}><MapPin size={19} /></span>
                    <span className={styles.statLabel}>ADDRESSES</span>
                    <strong>{addresses.length}</strong>
                    <small>Manage delivery details <ArrowRight size={13} /></small>
                  </Link>
                </div>

                <section className={styles.panel}>
                  <div className={styles.panelHeading}>
                    <div><p className={styles.eyebrow}>THE LATEST</p><h2>Recent orders</h2></div>
                    <Link href="/account/orders">SEE ALL <ArrowRight size={14} /></Link>
                  </div>
                  {recentOrders.length ? (
                    <div className={styles.orderList}>
                      {recentOrders.map((order) => (
                        <OrderRow key={order.id} order={order} />
                      ))}
                    </div>
                  ) : (
                    <EmptyState icon={Package} title="Your next favourite is waiting." text="Your order history will find a home here when you place your first order." href="/shop" action="FIND SOMETHING LOVELY" />
                  )}
                </section>

                <section className={styles.panel}>
                  <div className={styles.panelHeading}>
                    <div><p className={styles.eyebrow}>A LITTLE MORE ABOUT YOU</p><h2>Account details</h2></div>
                  </div>
                  <div className={styles.accountDetails}>
                    <div><span>FULL NAME</span><strong>{user?.name}</strong></div>
                    <div><span>EMAIL ADDRESS</span><strong>{user?.email}</strong></div>
                    <div><span>MEMBER SINCE</span><strong>Welcome to Seyora</strong></div>
                  </div>
                </section>
              </div>
            )}

            {activeSection === 'orders' && (
              <section className={styles.panel}>
                <div className={styles.panelHeading}>
                  <div><p className={styles.eyebrow}>MADE WITH CARE, SENT WITH LOVE</p><h2>Order history</h2></div>
                  <span className={styles.countPill}>{orders.length} {orders.length === 1 ? 'ORDER' : 'ORDERS'}</span>
                </div>
                {orders.length ? <div className={styles.orderList}>{orders.map((order) => <OrderRow key={order.id} order={order} />)}</div> : <EmptyState icon={Package} title="No orders just yet." text="When you find something that feels like you, your order details will show up here." href="/shop" action="EXPLORE THE SHOP" />}
              </section>
            )}

            {activeSection === 'wishlist' && (
              <section className={styles.panel}>
                <div className={styles.panelHeading}>
                  <div><p className={styles.eyebrow}>KEPT CLOSE FOR LATER</p><h2>Pieces you’ve saved</h2></div>
                  <span className={styles.countPill}>{wishlist.length} SAVED</span>
                </div>
                {wishlist.length ? (
                  <div className={styles.wishlistGrid}>
                    {wishlist.map(({ id, product }) => (
                      <article className={styles.wishCard} key={id}>
                        <Link href={`/product/${product.slug}`} className={styles.wishImage}>
                          {product.images[0]?.url && <Image src={product.images[0].url} alt={product.images[0].alt || product.name} fill sizes="(max-width: 700px) 45vw, 220px" unoptimized />}
                        </Link>
                        <div className={styles.wishInfo}>
                          <div><Link href={`/product/${product.slug}`}><strong>{product.name}</strong></Link><span>{money(product.price)}</span></div>
                          <button type="button" onClick={() => void removeWishlistItem(product.id)} disabled={busy} aria-label={`Remove ${product.name} from wishlist`}><X size={16} /></button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : <EmptyState icon={Heart} title="Keep a little list of lovely things." text="Tap the heart on anything you adore and it’ll be waiting here for you." href="/shop" action="DISCOVER THE COLLECTION" />}
              </section>
            )}

            {activeSection === 'addresses' && (
              <div className={styles.addressLayout}>
                <section className={styles.panel}>
                  <div className={styles.panelHeading}>
                    <div><p className={styles.eyebrow}>READY WHEN YOU ARE</p><h2>Your delivery addresses</h2></div>
                    <span className={styles.countPill}>{addresses.length} SAVED</span>
                  </div>
                  {addresses.length ? (
                    <div className={styles.addressList}>
                      {addresses.map((address) => (
                        <article className={styles.addressCard} key={address.id}>
                          <span className={styles.addressIcon}><MapPin size={18} /></span>
                          <div><strong>{address.name}</strong><p>{address.line1}{address.line2 ? `, ${address.line2}` : ''}<br />{address.city}, {address.state} {address.postalCode}<br />{address.country}<br />{address.phone}</p></div>
                          <button type="button" onClick={() => void removeAddress(address.id)} disabled={busy} aria-label={`Remove address for ${address.name}`}><X size={16} /></button>
                        </article>
                      ))}
                    </div>
                  ) : <p className={styles.subtle}>Add a delivery address to make your next order a little easier.</p>}
                </section>
                <form className={`${styles.panel} ${styles.addressForm}`} onSubmit={addAddress}>
                  <div className={styles.panelHeading}>
                    <div><p className={styles.eyebrow}>A NEW PLACE TO SEND LOVE</p><h2>Add an address</h2></div>
                  </div>
                  <div className={styles.formGrid}>
                    <label>Full name<input name="name" autoComplete="name" required placeholder="Name for delivery" /></label>
                    <label>Phone number<input name="phone" type="tel" autoComplete="tel" required placeholder="+91" /></label>
                    <label className={styles.fullWidth}>Address line<input name="line1" autoComplete="address-line1" required placeholder="House / flat, street" /></label>
                    <label className={styles.fullWidth}>Apartment or landmark <span className={styles.optional}>OPTIONAL</span><input name="line2" autoComplete="address-line2" placeholder="Apartment, suite, unit, etc." /></label>
                    <label>City<input name="city" autoComplete="address-level2" required /></label>
                    <label>State<input name="state" autoComplete="address-level1" required /></label>
                    <label>PIN code<input name="postalCode" inputMode="numeric" autoComplete="postal-code" required /></label>
                  </div>
                  <button className={styles.saveButton} type="submit" disabled={busy}><Plus size={16} /> {busy ? 'SAVING…' : 'SAVE ADDRESS'}</button>
                </form>
              </div>
            )}

            {activeSection === 'custom-orders' && (
              <section className={styles.panel}>
                <div className={styles.panelHeading}>
                  <div><p className={styles.eyebrow}>MADE JUST FOR YOU</p><h2>Your custom requests</h2></div>
                  <Link href="/custom-orders" className={styles.actionLink}><Plus size={15} /> NEW REQUEST</Link>
                </div>
                {requests.length ? (
                  <div className={styles.requestList}>
                    {requests.map((request) => (
                      <article className={styles.requestRow} key={request.requestId}>
                        <span className={styles.requestIcon}><ShoppingBag size={18} /></span>
                        <div><strong>{request.craftType}</strong><span>{request.requestId} · {date(request.createdAt)} · Qty {request.quantity}</span></div>
                        <span className={styles.status}>{humanize(request.status)}</span>
                      </article>
                    ))}
                  </div>
                ) : <EmptyState icon={ShoppingBag} title="Imagine it. We’ll make it." text="Your one-of-a-kind requests and their progress will be gathered here." href="/custom-orders" action="START A CUSTOM REQUEST" />}
              </section>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function OrderRow({ order }: { order: Order }) {
  const firstItem = order.items[0];
  const remaining = order.items.length - 1;
  return (
    <article className={styles.orderRow}>
      <div className={styles.orderImage}>
        {firstItem?.product?.images?.[0]?.url
          ? <Image src={firstItem.product.images[0].url} alt={firstItem.name} fill sizes="64px" unoptimized />
          : <Package size={22} />}
      </div>
      <div className={styles.orderMain}>
        <strong>{order.number}</strong>
        <span>{date(order.createdAt)} · {firstItem?.name || 'Handmade pieces'}{remaining > 0 ? ` + ${remaining} more` : ''}</span>
      </div>
      <div className={styles.orderMeta}>
        <span className={styles.status}>{humanize(order.status)}</span>
        <strong>{money(order.total)}</strong>
      </div>
      {order.shipping?.trackingUrl
        ? <a className={styles.orderAction} href={order.shipping.trackingUrl} target="_blank" rel="noreferrer">TRACK <ArrowUpRight size={14} /></a>
        : <span className={styles.orderNumber}>{order.shipping?.trackingNumber || ''}</span>}
    </article>
  );
}

function EmptyState({ icon: Icon, title, text, href, action }: {
  icon: typeof Package;
  title: string;
  text: string;
  href: string;
  action: string;
}) {
  return (
    <div className={styles.emptyState}>
      <span><Icon size={23} strokeWidth={1.5} /></span>
      <h3>{title}</h3>
      <p>{text}</p>
      <Link href={href}>{action} <ArrowRight size={14} /></Link>
    </div>
  );
}
