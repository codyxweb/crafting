'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, Heart, Minus, Plus, Star } from 'lucide-react';
import styles from './product-detail.module.css';

type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  compareAtPrice: number | null;
  material?: string | null;
  careInstructions?: string | null;
  shippingInformation?: string | null;
  published: boolean;
  inventory: { quantity: number } | null;
  variants: {
    id: string;
    color?: string | null;
    size?: string | null;
    material?: string | null;
    price: number | null;
    stock: number;
    imageUrl: string | null;
  }[];
  images: { url: string; alt: string | null }[];
  reviews: { id: string; rating: number; body: string; user: { name: string } }[];
};

const money = (minor: number) => `₹${(minor / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export function ProductDetail({ slug }: { slug: string }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [variantId, setVariantId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [personalization, setPersonalization] = useState('');
  const [note, setNote] = useState('');
  const [notice, setNotice] = useState('');
  const [requiresSignIn, setRequiresSignIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetch(`/api/products/${encodeURIComponent(slug)}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'This piece is not available right now.');
        setProduct(data.product);
      })
      .catch((cause: unknown) => {
        if (cause instanceof Error && cause.name === 'AbortError') return;
        setNotice(cause instanceof Error ? cause.message : 'This piece is not available right now.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [slug]);

  if (loading) {
    return <main className="generic"><div className="empty-page"><p>Bringing this lovely piece to you…</p></div></main>;
  }
  if (!product) {
    return (
      <main className="generic">
        <div className="empty-page">
          <p>{notice || 'This piece is not available right now.'}</p>
          <Link className="button dark" href="/shop">BACK TO THE SHOP <ArrowRight size={15} /></Link>
        </div>
      </main>
    );
  }

  const current = product;
  const selectedVariant = current.variants.find((variant) => variant.id === variantId);
  const price = selectedVariant?.price ?? current.price;
  const stock = selectedVariant?.stock ?? current.inventory?.quantity ?? 0;

  async function addToBag(buyNow = false) {
    if (current.variants.length > 0 && !selectedVariant) {
      setNotice('Please choose an option before continuing.');
      return;
    }
    if (quantity > stock) {
      setNotice('There is not enough stock for that quantity.');
      return;
    }
    setBusy(true);
    setNotice('');
    setRequiresSignIn(false);
    try {
      const response = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: current.id,
          variantId: selectedVariant?.id,
          quantity,
          customization: personalization || note ? { name: personalization, message: note } : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401) setRequiresSignIn(true);
        throw new Error(data.error || 'This piece could not be added to your bag.');
      }
      if (buyNow) {
        window.location.assign('/checkout');
        return;
      }
      window.dispatchEvent(new Event('seyora:cart-updated'));
      setNotice('Added to your bag. It’s waiting there for you.');
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function saveToWishlist() {
    setNotice('');
    setRequiresSignIn(false);
    try {
      const response = await fetch('/api/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: current.id }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401) setRequiresSignIn(true);
        throw new Error(data.error || 'This piece could not be saved.');
      }
      setNotice('Saved to your wishlist.');
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Please try again.');
    }
  }

  return (
    <main className="generic">
      <p className="eyebrow product-crumb"><Link href="/shop">SHOP</Link> / {product.name.toUpperCase()}</p>
      <div className="product-detail">
        <div className="detail-gallery">
          {product.images.map((image, index) => (
            <Image key={`${image.url}-${index}`} src={image.url} alt={image.alt || product.name} width={900} height={1100} unoptimized priority={index === 0} />
          ))}
        </div>
        <div className="product-buy-panel">
          <p className="eyebrow">MADE IN SMALL BATCHES</p>
          <h1>{product.name}</h1>
          <div className="rating">
            <Star size={14} fill="currentColor" />
            {product.reviews.length ? `${product.reviews[0].rating}.0 · ${product.reviews.length} thoughtful reviews` : 'New from our studio'}
          </div>
          <div className="product-prices">
            <strong>{money(price)}</strong>
            {product.compareAtPrice !== null && product.compareAtPrice > price && <del>{money(product.compareAtPrice)}</del>}
          </div>
          <p className="product-description">{product.description}</p>
          <p className={stock > 0 ? styles.stock : `${styles.stock} ${styles.outOfStock}`}>
            <span />{stock > 0 ? `In stock · ${stock} available` : 'Currently out of stock'}
          </p>

          {product.variants.length > 0 && (
            <label>
              Choose your finish
              <select value={variantId} onChange={(event) => { setVariantId(event.target.value); setQuantity(1); }}>
                <option value="">Select an option</option>
                {product.variants.map((variant) => (
                  <option key={variant.id} value={variant.id} disabled={variant.stock === 0}>
                    {[variant.color, variant.size, variant.material].filter(Boolean).join(' · ')}{variant.stock === 0 ? ' · Sold out' : ''}
                  </option>
                ))}
              </select>
            </label>
          )}

          {product.published && (
            <>
              <label>A name, if you’d like <span className={styles.optional}>OPTIONAL PERSONALISATION</span>
                <input value={personalization} maxLength={80} onChange={(event) => setPersonalization(event.target.value)} placeholder="Add a name or initials" />
              </label>
              <label>A little note <span className={styles.optional}>OPTIONAL</span>
                <textarea rows={2} maxLength={250} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Any special details for our maker?" />
              </label>
            </>
          )}

          <div className={styles.purchaseRow}>
            <div className={styles.quantity} aria-label="Choose quantity">
              <button type="button" aria-label="Decrease quantity" disabled={quantity <= 1} onClick={() => setQuantity((value) => Math.max(1, value - 1))}><Minus size={14} /></button>
              <span>{quantity}</span>
              <button type="button" aria-label="Increase quantity" disabled={quantity >= Math.min(stock, 25)} onClick={() => setQuantity((value) => Math.min(Math.min(stock, 25), value + 1))}><Plus size={14} /></button>
            </div>
            <span className={styles.lineTotal}>{money(price * quantity)}</span>
          </div>
          <button className="button dark full product-add-button" disabled={busy || stock === 0} onClick={() => void addToBag()}>
            {busy ? 'ADDING TO YOUR BAG…' : 'ADD TO BAG'}
          </button>
          <button className={`button outline full ${styles.buyButton}`} disabled={busy || stock === 0} onClick={() => void addToBag(true)}>
            {busy ? 'PLEASE WAIT…' : 'BUY NOW'}
          </button>
          <button className={`button outline full ${styles.wishlistButton}`} onClick={() => void saveToWishlist()}>
            <Heart size={15} /> SAVE TO WISHLIST
          </button>
          {notice && <p className={styles.notice} role="status">{notice}{requiresSignIn && <> <Link href={`/login?next=${encodeURIComponent(`/product/${product.slug}`)}`}>Sign in</Link> to continue.</>}</p>}

          <div className={styles.trust}>
            <span>Thoughtfully made by independent makers</span>
            <span>Complimentary shipping over ₹2,500</span>
            <span>Carefully packed across India</span>
          </div>
          <details><summary>Materials & care</summary><p>{product.material || 'Made with care.'} {product.careInstructions}</p></details>
          <details><summary>Shipping & returns</summary><p>{product.shippingInformation || 'Carefully packed and shipped across India.'}</p></details>
        </div>
      </div>
      <section className="section">
        <h2>Kind words from <i>you.</i></h2>
        {product.reviews.length
          ? product.reviews.map((review) => <blockquote className="review-row" key={review.id}>“{review.body}” <small>— {review.user.name} · Verified purchase</small></blockquote>)
          : <p className={styles.noReviews}>No reviews yet. Your note could be the first.</p>}
      </section>
    </main>
  );
}
