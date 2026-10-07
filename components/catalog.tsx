'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { Heart, Star } from 'lucide-react';
import styles from './catalog.module.css';

type Product = {
  id: string;
  slug: string;
  name: string;
  price: number;
  compareAtPrice: number | null;
  rating: number;
  reviewCount: number;
  images: { url: string; alt: string | null }[];
  inventory: { quantity: number } | null;
};

const money = (minor: number) => `₹${(minor / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export function CatalogGrid({ query = '' }: { query?: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [loginHref, setLoginHref] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    fetch('/api/products?limit=8' + (query ? '&q=' + encodeURIComponent(query) : ''), { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Products could not be loaded.');
        setProducts(data.items);
      })
      .catch((cause: unknown) => {
        if (cause instanceof Error && cause.name === 'AbortError') return;
        setError(cause instanceof Error ? cause.message : 'Products could not be loaded.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query]);

  async function add(product: Product) {
    setLoginHref('');
    if (product.inventory?.quantity === 0) {
      setToast('This piece is currently out of stock.');
      return;
    }
    try {
      const response = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id, quantity: 1 }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401) setLoginHref(`/login?next=${encodeURIComponent(`/product/${product.slug}`)}`);
        throw new Error(data.error || 'Please sign in to add this piece.');
      }
      window.dispatchEvent(new Event('seyora:cart-updated'));
      setToast('Added to your bag.');
    } catch (cause) {
      setToast(cause instanceof Error ? cause.message : 'Please try again.');
    }
  }

  async function wish(event: React.MouseEvent, product: Product) {
    event.preventDefault();
    event.stopPropagation();
    setLoginHref('');
    try {
      const response = await fetch('/api/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401) setLoginHref(`/login?next=${encodeURIComponent(`/product/${product.slug}`)}`);
        throw new Error(data.error || 'Please sign in to save pieces.');
      }
      setToast('Saved to your wishlist.');
    } catch (cause) {
      setToast(cause instanceof Error ? cause.message : 'Please try again.');
    }
  }

  if (loading) return <div className={styles.status} role="status">Finding something lovely for you…</div>;
  if (error) return <div className={`${styles.status} ${styles.error}`} role="alert">{error}</div>;
  if (!products.length) {
    return (
      <div className={styles.status}>
        <p>No pieces found just yet.</p>
        <Link href="/custom-orders">Ask us to make something for you →</Link>
      </div>
    );
  }

  return (
    <>
      <div className="product-grid">
        {products.map((product) => (
          <article className="product" key={product.id}>
            <div className="product-image">
              <Link href={`/product/${product.slug}`} aria-label={`View ${product.name}`}>
                {product.images[0]?.url && (
                  <Image src={product.images[0].url} alt={product.images[0].alt || product.name} width={900} height={1100} unoptimized />
                )}
              </Link>
              {product.compareAtPrice !== null && product.compareAtPrice > product.price && <span className="tag">A LITTLE LESS</span>}
              <button aria-label={`Save ${product.name}`} className="heart" onClick={(event) => void wish(event, product)}>
                <Heart size={18} />
              </button>
              <button
                className={`quick-add ${styles.quickAdd}`}
                disabled={product.inventory?.quantity === 0}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void add(product);
                }}
              >
                {product.inventory?.quantity === 0 ? 'OUT OF STOCK' : 'QUICK ADD +'}
              </button>
            </div>
            <div className="product-meta">
              <div>
                <Link href={`/product/${product.slug}`}>{product.name}</Link>
                <span className="rating"><Star size={12} fill="currentColor" /> {product.rating?.toFixed(1) || 'New'}</span>
              </div>
              <strong>{money(product.price)}</strong>
            </div>
            <small>{product.inventory?.quantity === 0 ? 'Currently unavailable' : `${product.reviewCount || 0} thoughtful reviews`}</small>
          </article>
        ))}
      </div>
      {toast && (
        <div className={`catalog-toast ${styles.toast}`} role="status">
          <span>{toast}</span>
          {loginHref && <Link href={loginHref}>Sign in</Link>}
          <button type="button" aria-label="Dismiss message" onClick={() => { setToast(''); setLoginHref(''); }}>×</button>
        </div>
      )}
    </>
  );
}
