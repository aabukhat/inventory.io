import { useState, useEffect } from 'react'
import { fetchProducts } from '../lib/products'

// No realtime subscription — the product catalog is rarely-changing
// reference data, only ever updated via a reviewed migration/regeneration
// script, same "no live subscription needed" reasoning as useFrequentDrinks.
export function useProducts() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProducts().then(setProducts).finally(() => setLoading(false))
  }, [])

  return { products, loading }
}
