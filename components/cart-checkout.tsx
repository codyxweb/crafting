'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import styles from './storefront.module.css';

type CartItem = {
  id: string;
  quantity: number;
  customization?: string | null;
  product: {
    name: string;
    slug: string;
    price: number;
    images: { url: string; alt?: string | null }[];
  };
  variant?: { price: number } | null;
};

type Address = {
  id: string;
  name: string;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postalCode: string;
};

const addressFields = [
  ['name', 'Full name', 'text'],
  ['phone', 'Phone number', 'tel'],
  ['line1', 'Address line 1', 'text'],
  ['line2', 'Address line 2 (optional)', 'text'],
  ['city', 'City', 'text'],
  ['state', 'State', 'text'],
  ['postalCode', 'PIN code', 'text'],
] as const;

const money = (minor: number) =>
  `₹${(minor / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/cart')
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not load your bag.');
        setItems(data.cart?.items || []);
      })
      .catch((cause: Error) => setError(cause.message));
  }, []);

  const subtotal = items.reduce(
    (sum, item) => sum + (item.variant?.price ?? item.product.price) * item.quantity,
    0,
  );

  return (
    <main className={styles.checkoutPage}>
      <h1>Your bag</h1>
      {error && <p role="alert">{error}</p>}
      {!items.length && !error && <p>Your bag is empty.</p>}
      {items.map((item) => (
        <article className={styles.cartItem} key={item.id}>
          {item.product.images[0]?.url && (
            <Image
              src={item.product.images[0].url}
              alt={item.product.images[0].alt || item.product.name}
              width={88}
              height={88}
              unoptimized
            />
          )}
          <div>
            <Link href={`/product/${item.product.slug}`}>{item.product.name}</Link>
            <p>Quantity: {item.quantity}</p>
            {item.customization && <p>Personalization: {item.customization}</p>}
          </div>
          <strong>
            {money((item.variant?.price ?? item.product.price) * item.quantity)}
          </strong>
        </article>
      ))}
      {!!items.length && (
        <>
          <p>Subtotal: {money(subtotal)}</p>
          <Link className={styles.primaryButton} href="/checkout">Continue to checkout</Link>
        </>
      )}
    </main>
  );
}

export function CheckoutPage() {
  const router = useRouter();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState('');
  const [items, setItems] = useState<CartItem[]>([]);
  const [form, setForm] = useState<Record<string, string>>({
    name: '',
    phone: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    postalCode: '',
  });
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;

    async function loadCheckout() {
      try {
        const [addressResponse, cartResponse] = await Promise.all([
          fetch('/api/addresses'),
          fetch('/api/cart'),
        ]);
        const addressData = await addressResponse.json();
        const cartData = await cartResponse.json();
        if (!addressResponse.ok) {
          setNeedsSignIn(addressResponse.status === 401);
          throw new Error(addressData.error || 'Please sign in to continue to checkout.');
        }
        if (!cartResponse.ok) {
          setNeedsSignIn(cartResponse.status === 401);
          throw new Error(cartData.error || 'Could not load your bag.');
        }
        if (!active) return;

        const savedAddresses: Address[] = addressData.addresses || [];
        setAddresses(savedAddresses);
        setSelectedAddress(savedAddresses[0]?.id || '');
        setShowAddressForm(savedAddresses.length === 0);
        setItems(cartData.cart?.items || []);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load checkout.');
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadCheckout();
    return () => {
      active = false;
    };
  }, []);

  const subtotal = useMemo(
    () => items.reduce(
      (sum, item) => sum + (item.variant?.price ?? item.product.price) * item.quantity,
      0,
    ),
    [items],
  );

  async function saveAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingAddress(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save this address.');
      const address: Address = data.address;
      setAddresses((current) => [...current, address]);
      setSelectedAddress(address.id);
      setShowAddressForm(false);
      setNotice('Delivery address saved.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this address.');
    } finally {
      setSavingAddress(false);
    }
  }

  async function placeOrder() {
    if (!selectedAddress) {
      setError('Add or select a delivery address before placing your order.');
      setShowAddressForm(true);
      return;
    }

    setPlacingOrder(true);
    setError('');
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addressId: selectedAddress, paymentMethod: 'COD' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not place your order.');
      router.push('/account/orders');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not place your order.');
    } finally {
      setPlacingOrder(false);
    }
  }

  return (
    <main className={styles.checkoutPage}>
      <h1>Checkout</h1>
      {loading ? (
        <p>Loading your checkout…</p>
      ) : needsSignIn ? (
        <section role="alert">
          <p>{error}</p>
          <Link href="/login">Sign in to continue</Link>
        </section>
      ) : error && !addresses.length && !items.length ? (
        <section role="alert">
          <p>{error}</p>
          <button className={styles.secondaryButton} type="button" onClick={() => window.location.reload()}>
            Try again
          </button>
        </section>
      ) : (
        <>
          {error && <p role="alert">{error}</p>}
          {notice && <p role="status">{notice}</p>}

          <section className={styles.checkoutSection} aria-labelledby="delivery-heading">
            <h2 id="delivery-heading">Delivery address</h2>
            {addresses.length > 0 && (
              <>
                <label htmlFor="checkout-address">Choose a saved address</label>
                <select
                  id="checkout-address"
                  value={selectedAddress}
                  onChange={(event) => setSelectedAddress(event.target.value)}
                >
                  {addresses.map((address) => (
                    <option key={address.id} value={address.id}>
                      {address.name} — {address.line1}, {address.city}
                    </option>
                  ))}
                </select>
              </>
            )}

            {showAddressForm ? (
              <form className={styles.addressForm} onSubmit={saveAddress}>
                {addressFields.map(([key, label, type]) => (
                  <label key={key}>
                    {label}
                    <input
                      className={styles.addressInput}
                      type={type}
                      value={form[key]}
                      required={key !== 'line2'}
                      autoComplete={
                        key === 'name' ? 'name'
                          : key === 'phone' ? 'tel'
                            : key === 'line1' ? 'address-line1'
                              : key === 'line2' ? 'address-line2'
                                : key === 'postalCode' ? 'postal-code'
                                  : key
                      }
                      onChange={(event) => setForm((current) => ({
                        ...current,
                        [key]: event.target.value,
                      }))}
                    />
                  </label>
                ))}
                <button className={styles.primaryButton} type="submit" disabled={savingAddress}>
                  {savingAddress ? 'Saving address…' : 'Save delivery address'}
                </button>
              </form>
            ) : (
              <button className={styles.secondaryButton} type="button" onClick={() => setShowAddressForm(true)}>
                Add another address
              </button>
            )}
          </section>

          <section className={styles.checkoutSection} aria-labelledby="summary-heading">
            <h2 id="summary-heading">Order summary</h2>
            {!items.length ? (
              <p>Your bag is empty. <Link href="/shop">Browse the shop</Link></p>
            ) : (
              <>
                {items.map((item) => (
                  <p key={item.id}>
                    {item.product.name} × {item.quantity}
                    {item.customization ? ` — ${item.customization}` : ''}
                    {' '}· {money((item.variant?.price ?? item.product.price) * item.quantity)}
                  </p>
                ))}
                <p>Subtotal: {money(subtotal)}</p>
                <p>Shipping: {subtotal >= 250000 ? 'Free' : money(15000)}</p>
                <p><strong>Total: {money(subtotal + (subtotal >= 250000 ? 0 : 15000))}</strong></p>
                <p>Payment: Cash on delivery</p>
              </>
            )}
          </section>

          <button
            type="button"
            className={styles.primaryButton}
            disabled={placingOrder || loading || !items.length || !selectedAddress}
            onClick={placeOrder}
          >
            {placingOrder ? 'Placing order…' : 'Place order'}
          </button>
        </>
      )}
    </main>
  );
}
