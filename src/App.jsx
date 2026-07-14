
import { useEffect, useState, useCallback } from 'react'
import {
  collection,
  getDocs,
  doc,
  getDoc,
} from 'firebase/firestore'
import './App.css'
import backgroundImage from './assets/background.jpeg'
import Admin from './Admin.jsx'
import { db } from './firebase.js'
import { menuSections } from './menuData.js'


const DEFAULT_SITE_SETTINGS = {
  siteNameEn: 'NINETY SIX',
  siteNameAr: 'ناينتي سيكس',
  welcomeEn: "Welcome, we're glad you're here.",
  welcomeAr: 'أهلًا بك، سعداء بوجودك.',
  descriptionEn: 'Take a look at our menu and enjoy your favorite drink.',
  descriptionAr: 'تصفح قائمتنا واستمتع بمشروبك المفضل.',
  workingHours: '8:00 AM – 2:00 AM',
  footerText: 'NINETY SIX DEGREES CAFE',
}

// Converts a Google Drive share/view link into a direct-viewable image URL.
// Falls back to the original URL when it isn't a recognizable Drive link.
function getDirectImageUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return ''
  }

  const url = rawUrl.trim()

  if (!url) {
    return ''
  }

  if (!url.includes('drive.google.com')) {
    return url
  }

  let fileId = ''

  const fileDMatch = url.match(/\/file\/d\/([^/]+)/)
  if (fileDMatch && fileDMatch[1]) {
    fileId = fileDMatch[1]
  }

  if (!fileId) {
    const idParamMatch = url.match(/[?&]id=([^&]+)/)
    if (idParamMatch && idParamMatch[1]) {
      fileId = idParamMatch[1]
    }
  }

  if (!fileId) {
    return url
  }

  return `https://lh3.googleusercontent.com/d/${fileId}`
}

function ProductImage({ src, alt, onClick, failed, onError }) {
  const resolvedSrc = getDirectImageUrl(src)
  const isClickable = Boolean(resolvedSrc) && !failed

  if (!resolvedSrc || failed) {
    return (
      <div className="productImage">
        <span>IMAGE</span>
      </div>
    )
  }

  return (
    <div
      className="productImage"
      onClick={isClickable ? onClick : undefined}
      style={{ cursor: isClickable ? 'pointer' : 'default' }}
    >
      <img
        className="productPhoto"
        src={resolvedSrc}
        alt={alt}
        loading="lazy"
        onError={onError}
      />
    </div>
  )
}

function ImageLightbox({ imageUrl, alt, onClose }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  if (!imageUrl) {
    return null
  }

  return (
    <div
      className="lightboxOverlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
    >
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onClose()
        }}
        aria-label="Close"
        style={{
          position: 'absolute',
          top: '18px',
          right: '18px',
          background: 'rgba(255, 255, 255, 0.15)',
          color: '#fff',
          border: 'none',
          borderRadius: '50%',
          width: '42px',
          height: '42px',
          fontSize: '22px',
          lineHeight: 1,
          cursor: 'pointer',
        }}
      >
        ×
      </button>

      <img
        src={imageUrl}
        alt={alt}
        onClick={(event) => event.stopPropagation()}
        style={{
          maxWidth: '95%',
          maxHeight: '90vh',
          objectFit: 'contain',
          borderRadius: '8px',
        }}
      />
    </div>
  )
}

function App() {
  const [firebaseMenu, setFirebaseMenu] = useState(menuSections)
  const [menuLoading, setMenuLoading] = useState(true)
  const [menuError, setMenuError] = useState('')
  const [siteSettings, setSiteSettings] = useState(DEFAULT_SITE_SETTINGS)
  const [lightboxImage, setLightboxImage] = useState(null)
  const [failedImages, setFailedImages] = useState({})

  const isAdminPage = window.location.pathname === '/admin'

  const closeLightbox = useCallback(() => {
    setLightboxImage(null)
  }, [])

  useEffect(() => {
    if (isAdminPage) {
      setMenuLoading(false)
      return
    }

    let cancelled = false

    async function loadSiteSettings() {
      try {
        const settingsSnapshot = await getDoc(
          doc(db, 'siteSettings', 'main'),
        )

        if (!cancelled && settingsSnapshot.exists()) {
          const data = settingsSnapshot.data()

          setSiteSettings({
            siteNameEn: data.siteNameEn ?? DEFAULT_SITE_SETTINGS.siteNameEn,
            siteNameAr: data.siteNameAr ?? DEFAULT_SITE_SETTINGS.siteNameAr,
            welcomeEn: data.welcomeEn ?? DEFAULT_SITE_SETTINGS.welcomeEn,
            welcomeAr: data.welcomeAr ?? DEFAULT_SITE_SETTINGS.welcomeAr,
            descriptionEn:
              data.descriptionEn ?? DEFAULT_SITE_SETTINGS.descriptionEn,
            descriptionAr:
              data.descriptionAr ?? DEFAULT_SITE_SETTINGS.descriptionAr,
            workingHours:
              data.workingHours ?? DEFAULT_SITE_SETTINGS.workingHours,
            footerText: data.footerText ?? DEFAULT_SITE_SETTINGS.footerText,
          })
        }
      } catch (settingsError) {
        console.error(settingsError)
      }
    }

    async function loadMenuFromFirebase() {
      setMenuLoading(true)
      setMenuError('')

      try {
        const categoriesSnapshot = await getDocs(
          collection(db, 'categories'),
        )

        const categories = categoriesSnapshot.docs
          .map((categoryDocument) => ({
            id: categoryDocument.id,
            ...categoryDocument.data(),
          }))
          .sort(
            (categoryA, categoryB) =>
              (categoryA.order || 0) - (categoryB.order || 0),
          )

        const sections = await Promise.all(
          categories.map(async (category) => {
            const productsSnapshot = await getDocs(
              collection(db, 'categories', category.id, 'products'),
            )

            const products = productsSnapshot.docs
              .map((productDocument) => ({
                id: productDocument.id,
                ...productDocument.data(),
              }))
              .filter((product) => product.visible !== false)
              .sort(
                (productA, productB) =>
                  (productA.order || 0) - (productB.order || 0),
              )

            return {
              id: category.id,
              titleEn: category.nameEn || category.id,
              titleAr: category.nameAr || '',
              products,
            }
          }),
        )

        if (!cancelled && sections.length > 0) {
          setFirebaseMenu(sections)
        }
      } catch (loadError) {
        console.error(loadError)

        if (!cancelled) {
          setMenuError('تعذر تحديث المنيو، تم عرض القائمة المحفوظة.')
        }
      } finally {
        if (!cancelled) {
          setMenuLoading(false)
        }
      }
    }

    loadSiteSettings()
    loadMenuFromFirebase()

    return () => {
      cancelled = true
    }
  }, [isAdminPage])

  if (isAdminPage) {
    return <Admin />
  }

  const firstSectionId = firebaseMenu[0]?.id || 'black'

  return (
    <main className="website">
      <section
        className="hero"
        style={{ backgroundImage: `url(${backgroundImage})` }}
      >
        <div className="heroShade" />

        <div className="heroContent">
          <h1 className="brandName">
            {siteSettings.siteNameEn}
            <span>{siteSettings.siteNameAr}</span>
          </h1>

          <div className="welcome">
            <h2>{siteSettings.welcomeEn}</h2>
            <h3>{siteSettings.welcomeAr}</h3>
          </div>

          <div className="description">
            <p>{siteSettings.descriptionEn}</p>
            <p dir="rtl">{siteSettings.descriptionAr}</p>
          </div>

          <div className="workingHours">
            <span>Open Daily | مفتوح يوميًا</span>
            <strong>{siteSettings.workingHours}</strong>
          </div>

          <a className="downArrow" href={`#${firstSectionId}`} aria-label="View menu">
            ↓
          </a>
        </div>
      </section>

      <nav className="categoryNavigation">
        <div className="categoryNavigationInner">
          {firebaseMenu.map((section) => (
            <a key={section.id} href={`#${section.id}`} className="navItem">
              <span>{section.titleEn}</span>
              <small>{section.titleAr}</small>
            </a>
          ))}
        </div>
      </nav>

      {menuLoading && (
        <p
          style={{
            textAlign: 'center',
            padding: '25px',
          }}
        >
          جاري تحديث المنيو...
        </p>
      )}

      {menuError && (
        <p
          style={{
            textAlign: 'center',
            padding: '15px',
            color: '#a01616',
          }}
        >
          {menuError}
        </p>
      )}

      <div className="menuArea">
        {firebaseMenu.map((section, index) => (
          <section className="menuSection" id={section.id} key={section.id}>
            <header className="menuSectionHeader">
              <span className="sectionNumber">
                {String(index + 1).padStart(2, '0')}
              </span>

              <div>
                <h2>{section.titleEn}</h2>
                <p>{section.titleAr}</p>
              </div>
            </header>

            <div className="productsGrid">
              {section.products.map((product) => {
                const productKey = product.id || `${section.id}-${product.nameEn}`
                const productAlt = product.nameAr || product.nameEn
                const directImageUrl = getDirectImageUrl(product.imageUrl)
                const hasFailed = Boolean(failedImages[productKey])

                return (
                  <article className="productCard" key={productKey}>
                    <ProductImage
                      src={product.imageUrl}
                      alt={productAlt}
                      failed={hasFailed}
                      onError={() =>
                        setFailedImages((previous) => ({
                          ...previous,
                          [productKey]: true,
                        }))
                      }
                      onClick={() =>
                        setLightboxImage({
                          url: directImageUrl,
                          alt: productAlt,
                        })
                      }
                    />

                    <div className="productDetails">
                      <h3>{product.nameEn}</h3>
                      <p>{product.nameAr}</p>

                      <div className="productPrice">
                        <strong>{product.price}</strong>
                        <span>BD</span>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      <footer className="footer">
        <p>{siteSettings.footerText}</p>
      </footer>

      {lightboxImage && (
        <ImageLightbox
          imageUrl={lightboxImage.url}
          alt={lightboxImage.alt}
          onClose={closeLightbox}
        />
      )}
    </main>
  )
}

export default App
