
import { useEffect, useRef, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from 'firebase/firestore'

import { auth, db } from './firebase.js'
import { menuSections } from './menuData.js'
import './Admin.css'

const defaultSiteSettings = {
  siteNameEn: 'NINETY SIX',
  siteNameAr: '',
  welcomeEn: "Welcome, we're glad you're here.",
  welcomeAr: 'أهلًا بك، سعداء بوجودك.',
  descriptionEn: 'Take a look at our menu and enjoy your favorite drink.',
  descriptionAr: 'تصفح قائمتنا واستمتع بمشروبك المفضل.',
  workingHours: '8:00 AM – 2:00 AM',
  footerText: 'NINETY SIX DEGREES CAFE',
}

function convertGoogleDriveLink(url) {
  if (!url) return ''

  const trimmed = url.trim()

  if (!trimmed) return ''

  if (!trimmed.includes('drive.google.com')) {
    return trimmed
  }

  let fileId = ''

  const fileMatch = trimmed.match(/\/file\/d\/([^/]+)/)

  if (fileMatch && fileMatch[1]) {
    fileId = fileMatch[1]
  }

  if (!fileId) {
    const idParamMatch = trimmed.match(/[?&]id=([^&]+)/)

    if (idParamMatch && idParamMatch[1]) {
      fileId = idParamMatch[1]
    }
  }

  if (fileId) {
    return `https://lh3.googleusercontent.com/d/${fileId}`
  }

  return trimmed
}

function createProductId(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function Admin() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [uploadingMenu, setUploadingMenu] = useState(false)
  const [uploadMessage, setUploadMessage] = useState('')

  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [imageErrorIds, setImageErrorIds] = useState({})

  const [loadingProducts, setLoadingProducts] = useState(false)

  const [view, setView] = useState('dashboard')

  const [showProducts, setShowProducts] = useState(false)
  const [showProductForm, setShowProductForm] = useState(false)

  const [editingProduct, setEditingProduct] = useState(null)

  const [productNameEn, setProductNameEn] = useState('')
  const [productNameAr, setProductNameAr] = useState('')
  const [productPrice, setProductPrice] = useState('')
  const [productCategory, setProductCategory] = useState('')
  const [productOrder, setProductOrder] = useState(1)
  const [productVisible, setProductVisible] = useState(true)
  const [productImageUrl, setProductImageUrl] = useState('')
  const [imgLoadError, setImgLoadError] = useState(false)

  const [savingProduct, setSavingProduct] = useState(false)
  const [search, setSearch] = useState('')
  const [productSuccessMessage, setProductSuccessMessage] = useState('')

  const [showSiteSettings, setShowSiteSettings] = useState(false)
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [settingsMessage, setSettingsMessage] = useState('')

  const [siteNameEn, setSiteNameEn] = useState('')
  const [siteNameAr, setSiteNameAr] = useState('')

  const [welcomeEn, setWelcomeEn] = useState('')
  const [welcomeAr, setWelcomeAr] = useState('')

  const [descriptionEn, setDescriptionEn] = useState('')
  const [descriptionAr, setDescriptionAr] = useState('')

  const [workingHours, setWorkingHours] = useState('')
  const [footerText, setFooterText] = useState('')

  const [savingSettings, setSavingSettings] = useState(false)

  const [showCategories, setShowCategories] = useState(false)
  const [showCategoryForm, setShowCategoryForm] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)

  const [categoryNameEn, setCategoryNameEn] = useState('')
  const [categoryNameAr, setCategoryNameAr] = useState('')
  const [categoryOrder, setCategoryOrder] = useState(1)
  const [savingCategory, setSavingCategory] = useState(false)
  const [categorySuccessMessage, setCategorySuccessMessage] = useState('')

  const productFormRef = useRef(null)
  const categoryFormRef = useRef(null)
  const siteSettingsRef = useRef(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      setLoading(false)
    })

    return unsubscribe
  }, [])

  useEffect(() => {
    if (user) {
      loadSiteSettings()
    }
  }, [user])

  useEffect(() => {
    if (showProductForm && productFormRef.current) {
      productFormRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }
  }, [showProductForm])

  useEffect(() => {
    if (showCategoryForm && categoryFormRef.current) {
      categoryFormRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }
  }, [showCategoryForm])

  useEffect(() => {
    if (showSiteSettings && siteSettingsRef.current) {
      siteSettingsRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }
  }, [showSiteSettings])

  function clearMessages() {
    setError('')
    setUploadMessage('')
    setSettingsMessage('')
    setProductSuccessMessage('')
    setCategorySuccessMessage('')
  }

  function closeAllSections() {
    setShowProducts(false)
    setShowProductForm(false)
    setShowCategories(false)
    setShowCategoryForm(false)
    setShowSiteSettings(false)
  }

  function goToDashboard() {
    closeAllSections()
    resetProductForm()
    resetCategoryForm()
    clearMessages()
    setView('dashboard')
  }

  async function loadProducts(openSection = true) {
    setLoadingProducts(true)
    setError('')
    setImageErrorIds({})

    try {
      const categoriesSnapshot = await getDocs(
        collection(db, 'categories'),
      )

      const loadedCategories = categoriesSnapshot.docs
        .map((categoryDoc) => ({
          id: categoryDoc.id,
          ...categoryDoc.data(),
        }))
        .sort((a, b) => (a.order || 0) - (b.order || 0))

      const allProducts = []

      for (const category of loadedCategories) {
        const productsSnapshot = await getDocs(
          collection(
            db,
            'categories',
            category.id,
            'products',
          ),
        )

        productsSnapshot.forEach((productDoc) => {
          allProducts.push({
            id: productDoc.id,
            categoryId: category.id,
            categoryNameEn: category.nameEn,
            categoryNameAr: category.nameAr,
            ...productDoc.data(),
          })
        })
      }

      allProducts.sort((a, b) => {
        const orderA =
          loadedCategories.find(
            (item) => item.id === a.categoryId,
          )?.order || 0

        const orderB =
          loadedCategories.find(
            (item) => item.id === b.categoryId,
          )?.order || 0

        if (orderA !== orderB) {
          return orderA - orderB
        }

        return (a.order || 0) - (b.order || 0)
      })

      setCategories(loadedCategories)
      setProducts(allProducts)

      if (openSection) {
        setShowProducts(true)
      }
    } catch (err) {
      console.error(err)
      setError('صار خطأ أثناء تحميل المنتجات')
    } finally {
      setLoadingProducts(false)
    }
  }

  async function openProducts() {
    closeAllSections()
    clearMessages()
    setView('products')
    await loadProducts(true)
  }

  function resetProductForm() {
    setEditingProduct(null)
    setProductNameEn('')
    setProductNameAr('')
    setProductPrice('')
    setProductCategory(categories[0]?.id || '')
    setProductOrder(1)
    setProductVisible(true)
    setProductImageUrl('')
    setImgLoadError(false)
  }

  function openNewProduct() {
    resetProductForm()
    setShowProductForm(true)
    setError('')
    setProductSuccessMessage('')
  }

  function openEditProduct(product) {
    setEditingProduct(product)
    setProductNameEn(product.nameEn || '')
    setProductNameAr(product.nameAr || '')
    setProductPrice(product.price || '')
    setProductCategory(product.categoryId || '')
    setProductOrder(product.order || 1)
    setProductVisible(product.visible !== false)
    setProductImageUrl(product.imageUrl || '')
    setImgLoadError(false)
    setShowProductForm(true)
    setError('')
    setProductSuccessMessage('')
  }

  async function saveProduct(event) {
    event.preventDefault()

    setSavingProduct(true)
    setError('')
    setProductSuccessMessage('')

    try {
      if (!productNameEn.trim()) {
        throw new Error('اكتب اسم المنتج بالإنجليزي')
      }

      if (!productNameAr.trim()) {
        throw new Error('اكتب اسم المنتج بالعربي')
      }

      if (!productPrice.trim()) {
        throw new Error('اكتب السعر')
      }

      if (!productCategory) {
        throw new Error('اختر القسم')
      }

      const isNewProduct = !editingProduct
      const isMovingCategory =
        editingProduct &&
        editingProduct.categoryId !== productCategory

      const productId = editingProduct
        ? editingProduct.id
        : createProductId(productNameEn)

      const finalImageUrl = convertGoogleDriveLink(
        productImageUrl.trim(),
      )

      await setDoc(
        doc(
          db,
          'categories',
          productCategory,
          'products',
          productId,
        ),
        {
          nameEn: productNameEn.trim(),
          nameAr: productNameAr.trim(),
          price: productPrice.trim(),
          order: Number(productOrder) || 1,
          visible: productVisible,
          imageUrl: finalImageUrl,
        },
        { merge: true },
      )

      if (isMovingCategory) {
        await deleteDoc(
          doc(
            db,
            'categories',
            editingProduct.categoryId,
            'products',
            editingProduct.id,
          ),
        )
      }

      await loadProducts(true)

      setShowProductForm(false)
      resetProductForm()

      setProductSuccessMessage(
        isNewProduct
          ? 'تمت إضافة المنتج بنجاح'
          : 'تم تحديث المنتج بنجاح',
      )
    } catch (saveError) {
      console.error(saveError)

      setError(
        saveError.message ||
          'صار خطأ أثناء حفظ المنتج',
      )
    } finally {
      setSavingProduct(false)
    }
  }

  async function deleteProduct(product) {
    const confirmed = window.confirm(
      `هل أنت متأكد من حذف ${product.nameAr || product.nameEn}؟`,
    )

    if (!confirmed) return

    setError('')
    setProductSuccessMessage('')

    try {
      await deleteDoc(
        doc(
          db,
          'categories',
          product.categoryId,
          'products',
          product.id,
        ),
      )

      await loadProducts(true)

      setProductSuccessMessage('تم حذف المنتج بنجاح')
    } catch (deleteError) {
      console.error(deleteError)
      setError('تعذر حذف المنتج')
    }
  }

  async function toggleProductVisibility(product) {
    setError('')
    setProductSuccessMessage('')

    try {
      await setDoc(
        doc(
          db,
          'categories',
          product.categoryId,
          'products',
          product.id,
        ),
        {
          visible: product.visible === false,
        },
        { merge: true },
      )

      await loadProducts(true)

      setProductSuccessMessage('تم تغيير حالة ظهور المنتج')
    } catch (visibilityError) {
      console.error(visibilityError)
      setError('تعذر تغيير حالة المنتج')
    }
  }

  function resetCategoryForm() {
    setEditingCategory(null)
    setCategoryNameEn('')
    setCategoryNameAr('')
    setCategoryOrder(categories.length + 1)
  }

  async function openCategories() {
    closeAllSections()
    clearMessages()
    setView('categories')

    await loadProducts(false)

    setShowCategories(true)
  }

  async function openSiteSettings() {
    closeAllSections()
    clearMessages()
    setView('settings')

    setShowSiteSettings(true)

    await loadSiteSettings()
  }

  function openNewCategory() {
    resetCategoryForm()
    setShowCategoryForm(true)
    setError('')
    setCategorySuccessMessage('')
  }

  function openEditCategory(category) {
    setEditingCategory(category)
    setCategoryNameEn(category.nameEn || '')
    setCategoryNameAr(category.nameAr || '')
    setCategoryOrder(category.order || 1)
    setShowCategoryForm(true)
    setError('')
    setCategorySuccessMessage('')
  }

  async function saveCategory(event) {
    event.preventDefault()

    setSavingCategory(true)
    setError('')
    setCategorySuccessMessage('')

    try {
      if (!categoryNameEn.trim()) {
        throw new Error('اكتب اسم القسم بالإنجليزي')
      }

      if (!categoryNameAr.trim()) {
        throw new Error('اكتب اسم القسم بالعربي')
      }

      const isNewCategory = !editingCategory

      const categoryId = editingCategory
        ? editingCategory.id
        : createProductId(categoryNameEn)

      await setDoc(
        doc(db, 'categories', categoryId),
        {
          nameEn: categoryNameEn.trim(),
          nameAr: categoryNameAr.trim(),
          order: Number(categoryOrder) || 1,
        },
        { merge: true },
      )

      await loadProducts(false)

      setShowCategoryForm(false)
      resetCategoryForm()

      setCategorySuccessMessage(
        isNewCategory
          ? 'تمت إضافة القسم بنجاح'
          : 'تم تحديث القسم بنجاح',
      )
    } catch (saveError) {
      console.error(saveError)

      setError(
        saveError.message ||
          'صار خطأ أثناء حفظ القسم',
      )
    } finally {
      setSavingCategory(false)
    }
  }

  async function deleteCategory(category) {
    const categoryProducts = products.filter(
      (product) => product.categoryId === category.id,
    )

    if (categoryProducts.length > 0) {
      setError('لا يمكن حذف القسم لوجود منتجات بداخله، احذف أو انقل المنتجات أولًا')
      setCategorySuccessMessage('')
      return
    }

    const confirmed = window.confirm(
      `هل أنت متأكد من حذف قسم ${category.nameAr}؟`,
    )

    if (!confirmed) return

    setError('')
    setCategorySuccessMessage('')

    try {
      await deleteDoc(
        doc(db, 'categories', category.id),
      )

      await loadProducts(false)

      setCategorySuccessMessage('تم حذف القسم بنجاح')
    } catch (deleteError) {
      console.error(deleteError)
      setError('تعذر حذف القسم')
    }
  }

  async function loadSiteSettings() {
    setSettingsLoading(true)
    setSettingsMessage('')

    try {
      const settingsDoc = await getDoc(
        doc(db, 'siteSettings', 'main'),
      )

      const data = settingsDoc.exists()
        ? settingsDoc.data()
        : {}

      setSiteNameEn(
        data.siteNameEn ?? defaultSiteSettings.siteNameEn,
      )
      setSiteNameAr(
        data.siteNameAr ?? defaultSiteSettings.siteNameAr,
      )
      setWelcomeEn(
        data.welcomeEn ?? defaultSiteSettings.welcomeEn,
      )
      setWelcomeAr(
        data.welcomeAr ?? defaultSiteSettings.welcomeAr,
      )
      setDescriptionEn(
        data.descriptionEn ?? defaultSiteSettings.descriptionEn,
      )
      setDescriptionAr(
        data.descriptionAr ?? defaultSiteSettings.descriptionAr,
      )
      setWorkingHours(
        data.workingHours ?? defaultSiteSettings.workingHours,
      )
      setFooterText(
        data.footerText ?? defaultSiteSettings.footerText,
      )
    } catch (settingsError) {
      console.error(settingsError)
      setError('تعذر تحميل إعدادات الموقع')
    } finally {
      setSettingsLoading(false)
    }
  }

  async function saveSiteSettings(event) {
    event.preventDefault()

    setSavingSettings(true)
    setError('')
    setSettingsMessage('')

    try {
      await setDoc(
        doc(db, 'siteSettings', 'main'),
        {
          siteNameEn: siteNameEn.trim(),
          siteNameAr: siteNameAr.trim(),
          welcomeEn: welcomeEn.trim(),
          welcomeAr: welcomeAr.trim(),
          descriptionEn: descriptionEn.trim(),
          descriptionAr: descriptionAr.trim(),
          workingHours: workingHours.trim(),
          footerText: footerText.trim(),
        },
        { merge: true },
      )

      setSettingsMessage('تم حفظ إعدادات الموقع بنجاح')
    } catch (saveError) {
      console.error(saveError)
      setError('صار خطأ أثناء حفظ إعدادات الموقع')
    } finally {
      setSavingSettings(false)
    }
  }

  async function handleLogin(event) {
    event.preventDefault()

    setError('')
    setSubmitting(true)

    try {
      await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      )
    } catch (loginError) {
      console.error(loginError)
      setError('الإيميل أو كلمة المرور غير صحيحة')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleLogout() {
    setError('')

    try {
      await signOut(auth)
    } catch (logoutError) {
      console.error(logoutError)
      setError('تعذر تسجيل الخروج، حاول مرة ثانية')
    }
  }

  async function uploadMenu() {
    const confirmed = window.confirm(
      'سيتم رفع أو تحديث بيانات المنيو الأساسية في Firebase. لن يتم حذف الصور أو حالة الظهور الحالية للمنتجات الموجودة. هل تريد المتابعة؟',
    )

    if (!confirmed) return

    setUploadingMenu(true)
    setUploadMessage('')
    setError('')

    try {
      for (
        let sectionIndex = 0;
        sectionIndex < menuSections.length;
        sectionIndex += 1
      ) {
        const section = menuSections[sectionIndex]

        await setDoc(
          doc(db, 'categories', section.id),
          {
            nameEn: section.titleEn,
            nameAr: section.titleAr,
            order: sectionIndex + 1,
          },
          { merge: true },
        )

        for (
          let productIndex = 0;
          productIndex < section.products.length;
          productIndex += 1
        ) {
          const product = section.products[productIndex]
          const productId = createProductId(product.nameEn)

          const productRef = doc(
            db,
            'categories',
            section.id,
            'products',
            productId,
          )

          const existingSnap = await getDoc(productRef)
          const existingData = existingSnap.exists()
            ? existingSnap.data()
            : null

          const productData = {
            nameEn: product.nameEn,
            nameAr: product.nameAr,
            price: product.price,
            order: productIndex + 1,
          }

          if (!existingData || existingData.imageUrl === undefined) {
            productData.imageUrl = ''
          }

          if (!existingData || existingData.visible === undefined) {
            productData.visible = true
          }

          await setDoc(productRef, productData, { merge: true })
        }
      }

      setUploadMessage('تم رفع المنيو كاملة إلى Firebase بنجاح')

      await loadProducts(false)
    } catch (uploadError) {
      console.error(uploadError)
      setError('صار خطأ أثناء رفع المنيو، حاول مرة ثانية')
    } finally {
      setUploadingMenu(false)
    }
  }

  if (loading) {
    return (
      <main className="adminLoading" dir="rtl">
        جاري التحميل...
      </main>
    )
  }

  if (!user) {
    return (
      <main className="adminLoginPage" dir="rtl">
        <form
          className="adminLoginCard"
          onSubmit={handleLogin}
        >
          <div className="adminBrand">
            <span>NINETY SIX</span>
            <small>ADMIN PANEL</small>
          </div>

          <h1>تسجيل دخول الإدارة</h1>

          <p>
            أدخل البريد الإلكتروني وكلمة المرور للمتابعة.
          </p>

          <label>
            البريد الإلكتروني

            <input
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="admin@96cafe.com"
              autoComplete="email"
              required
            />
          </label>

          <label>
            كلمة المرور

            <input
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </label>

          {error && (
            <div className="adminError">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
          >
            {submitting
              ? 'جاري تسجيل الدخول...'
              : 'تسجيل الدخول'}
          </button>

          <a
            href="/"
            className="backToMenu"
          >
            الرجوع إلى المنيو
          </a>
        </form>
      </main>
    )
  }

  const filteredProducts = products.filter((product) => {
    const word = search.trim().toLowerCase()

    if (!word) return true

    return (
      product.nameEn?.toLowerCase().includes(word) ||
      product.nameAr?.includes(search.trim()) ||
      product.categoryNameEn?.toLowerCase().includes(word) ||
      product.categoryNameAr?.includes(search.trim())
    )
  })

  const previewImageUrl = convertGoogleDriveLink(
    productImageUrl.trim(),
  )

  return (
    <main className="adminDashboard" dir="rtl">
      <header className="adminTopBar">
        <div>
          <strong>NINETY SIX</strong>
          <span>لوحة الإدارة</span>
        </div>

        <button
          type="button"
          onClick={handleLogout}
        >
          تسجيل الخروج
        </button>
      </header>

      <section className="adminWelcome">
        <h1>مرحبًا بك</h1>
        <p>{user.email}</p>
      </section>

      {view === 'dashboard' && (
        <>
          <section className="menuUploadSection">
            <button
              type="button"
              onClick={uploadMenu}
              disabled={uploadingMenu}
            >
              {uploadingMenu
                ? 'جاري رفع المنيو...'
                : 'رفع وتحديث المنيو في Firebase'}
            </button>

            {uploadMessage && (
              <p className="uploadSuccess">
                {uploadMessage}
              </p>
            )}
          </section>

          {error && (
            <div className="adminDashboardError">
              {error}
            </div>
          )}

          <section className="adminCards">
            <article
              onClick={openProducts}
              style={{ cursor: 'pointer' }}
            >
              <h2>المنتجات</h2>
              <p>
                إضافة المشروبات والحلويات وتعديلها وحذفها.
              </p>
            </article>

            <article
              onClick={openCategories}
              style={{ cursor: 'pointer' }}
            >
              <h2>الأقسام</h2>
              <p>
                إضافة قسم جديد وتعديل الأقسام وحذفها.
              </p>
            </article>

            <article className="adminCardDisabled">
              <h2>الصور</h2>
              <p>
                تدار صور المنتجات من خلال حقل رابط الصورة (Image URL) الموجود داخل كل منتج.
              </p>
            </article>

            <article
              onClick={openSiteSettings}
              style={{ cursor: 'pointer' }}
            >
              <h2>إعدادات الموقع</h2>
              <p>
                تعديل اسم الكوفي والترحيب والوصف وساعات العمل.
              </p>
            </article>
          </section>
        </>
      )}

      {view === 'settings' && showSiteSettings && (
        <section
          className="adminSiteSettingsSection"
          ref={siteSettingsRef}
        >
          <div className="adminProductsHeader">
            <div>
              <h2>إعدادات الموقع</h2>
              <p>تعديل اسم الكوفي والترحيب والوصف وساعات العمل.</p>
            </div>

            <button
              type="button"
              onClick={goToDashboard}
            >
              الرجوع للوحة الرئيسية
            </button>
          </div>

          {error && (
            <div className="adminDashboardError">
              {error}
            </div>
          )}

          {settingsLoading ? (
            <p>جاري تحميل الإعدادات...</p>
          ) : (
            <form
              className="adminSiteSettingsForm"
              onSubmit={saveSiteSettings}
            >
              <div className="adminSiteSettingsGrid">
                <label>
                  اسم الموقع بالإنجليزي

                  <input
                    type="text"
                    value={siteNameEn}
                    onChange={(event) =>
                      setSiteNameEn(event.target.value)
                    }
                  />
                </label>

                <label>
                  اسم الموقع بالعربي

                  <input
                    type="text"
                    value={siteNameAr}
                    onChange={(event) =>
                      setSiteNameAr(event.target.value)
                    }
                  />
                </label>

                <label>
                  رسالة الترحيب بالإنجليزي

                  <input
                    type="text"
                    value={welcomeEn}
                    onChange={(event) =>
                      setWelcomeEn(event.target.value)
                    }
                  />
                </label>

                <label>
                  رسالة الترحيب بالعربي

                  <input
                    type="text"
                    value={welcomeAr}
                    onChange={(event) =>
                      setWelcomeAr(event.target.value)
                    }
                  />
                </label>

                <label>
                  الوصف بالإنجليزي

                  <textarea
                    value={descriptionEn}
                    onChange={(event) =>
                      setDescriptionEn(event.target.value)
                    }
                  />
                </label>

                <label>
                  الوصف بالعربي

                  <textarea
                    value={descriptionAr}
                    onChange={(event) =>
                      setDescriptionAr(event.target.value)
                    }
                  />
                </label>

                <label>
                  ساعات العمل

                  <input
                    type="text"
                    value={workingHours}
                    onChange={(event) =>
                      setWorkingHours(event.target.value)
                    }
                    placeholder="8:00 AM – 2:00 AM"
                  />
                </label>

                <label>
                  نص الفوتر

                  <input
                    type="text"
                    value={footerText}
                    onChange={(event) =>
                      setFooterText(event.target.value)
                    }
                  />
                </label>
              </div>

              {settingsMessage && (
                <p className="uploadSuccess">
                  {settingsMessage}
                </p>
              )}

              <div className="adminProductFormButtons">
                <button
                  type="submit"
                  disabled={savingSettings}
                >
                  {savingSettings
                    ? 'جاري الحفظ...'
                    : 'حفظ الإعدادات'}
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      {view === 'products' && showProducts && (
        <section className="adminProductsSection">
          <div className="adminProductsHeader">
            <div>
              <h2>إدارة المنتجات</h2>
              <p>إضافة وتعديل وحذف المنتجات والصور.</p>
            </div>

            <div className="adminProductsHeaderButtons">
              <button
                type="button"
                onClick={openNewProduct}
              >
                + إضافة منتج
              </button>

              <button
                type="button"
                onClick={goToDashboard}
              >
                الرجوع للوحة الرئيسية
              </button>
            </div>
          </div>

          {error && (
            <div className="adminDashboardError">
              {error}
            </div>
          )}

          {productSuccessMessage && (
            <p className="uploadSuccess">
              {productSuccessMessage}
            </p>
          )}

          <input
            className="adminProductSearch"
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="ابحث عن منتج..."
          />

          {showProductForm && (
            <form
              className="adminProductForm"
              onSubmit={saveProduct}
              ref={productFormRef}
            >
              <h3>
                {editingProduct
                  ? 'تعديل المنتج'
                  : 'إضافة منتج جديد'}
              </h3>

              <div className="adminProductFormGrid">
                <label>
                  الاسم بالإنجليزي

                  <input
                    type="text"
                    value={productNameEn}
                    onChange={(event) =>
                      setProductNameEn(event.target.value)
                    }
                    required
                  />
                </label>

                <label>
                  الاسم بالعربي

                  <input
                    type="text"
                    value={productNameAr}
                    onChange={(event) =>
                      setProductNameAr(event.target.value)
                    }
                    required
                  />
                </label>

                <label>
                  السعر

                  <input
                    type="text"
                    value={productPrice}
                    onChange={(event) =>
                      setProductPrice(event.target.value)
                    }
                    placeholder="1.500"
                    required
                  />
                </label>

                <label>
                  القسم

                  <select
                    value={productCategory}
                    onChange={(event) =>
                      setProductCategory(event.target.value)
                    }
                    required
                  >
                    <option value="">
                      اختر القسم
                    </option>

                    {categories.map((category) => (
                      <option
                        key={category.id}
                        value={category.id}
                      >
                        {category.nameAr} - {category.nameEn}
                      </option>
                    ))}
                  </select>

                  {categories.length === 0 && (
                    <small>لا توجد أقسام، أضف قسمًا أولًا</small>
                  )}
                </label>

                <label>
                  الترتيب

                  <input
                    type="number"
                    min="1"
                    value={productOrder}
                    onChange={(event) =>
                      setProductOrder(event.target.value)
                    }
                  />
                </label>

                <label className="productVisibleLabel">
                  <input
                    type="checkbox"
                    checked={productVisible}
                    onChange={(event) =>
                      setProductVisible(event.target.checked)
                    }
                  />

                  إظهار المنتج في المنيو
                </label>
              </div>

              <label className="adminImageUrlLabel">
                رابط صورة المنتج

                <input
                  type="text"
                  value={productImageUrl}
                  onChange={(event) => {
                    setProductImageUrl(event.target.value)
                    setImgLoadError(false)
                  }}
                  placeholder="https://... أو رابط Google Drive"
                />
              </label>

              <div className="adminImagePreview">
                {previewImageUrl && !imgLoadError ? (
                  <img
                    className="adminCurrentProductImage"
                    src={previewImageUrl}
                    alt="معاينة الصورة"
                    onError={() => setImgLoadError(true)}
                  />
                ) : (
                  <div className="adminImagePlaceholder">
                    لا توجد صورة
                  </div>
                )}

                {productImageUrl.trim() && (
                  <button
                    type="button"
                    className="clearImageButton"
                    onClick={() => {
                      setProductImageUrl('')
                      setImgLoadError(false)
                    }}
                  >
                    إزالة الصورة
                  </button>
                )}
              </div>

              <div className="adminProductFormButtons">
                <button
                  type="submit"
                  disabled={savingProduct}
                >
                  {savingProduct
                    ? 'جاري الحفظ...'
                    : 'حفظ المنتج'}
                </button>

                <button
                  type="button"
                  className="cancelProductButton"
                  disabled={savingProduct}
                  onClick={() => {
                    setShowProductForm(false)
                    resetProductForm()
                  }}
                >
                  إلغاء
                </button>
              </div>
            </form>
          )}

          {loadingProducts ? (
            <p>جاري تحميل المنتجات...</p>
          ) : (
            <div className="adminProductsTableWrapper">
              {filteredProducts.length === 0 ? (
                <p>لا توجد منتجات مطابقة</p>
              ) : (
                <table className="adminProductsTable">
                  <thead>
                    <tr>
                      <th>الصورة</th>
                      <th>المنتج</th>
                      <th>القسم</th>
                      <th>السعر</th>
                      <th>الحالة</th>
                      <th>التحكم</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredProducts.map((product) => {
                      const rowKey = `${product.categoryId}-${product.id}`
                      const hasImageError = imageErrorIds[rowKey]

                      return (
                        <tr key={rowKey}>
                          <td>
                            {product.imageUrl && !hasImageError ? (
                              <img
                                className="adminProductImage"
                                src={convertGoogleDriveLink(product.imageUrl)}
                                alt={product.nameAr}
                                onError={() => {
                                  setImageErrorIds((prev) => ({
                                    ...prev,
                                    [rowKey]: true,
                                  }))
                                }}
                              />
                            ) : product.imageUrl && hasImageError ? (
                              <span className="adminImageUnavailable">
                                صورة غير متاحة
                              </span>
                            ) : (
                              <span>بدون صورة</span>
                            )}
                          </td>

                          <td>
                            <strong>{product.nameAr}</strong>
                            <small>{product.nameEn}</small>
                          </td>

                          <td>
                            <strong>
                              {product.categoryNameAr}
                            </strong>
                            <small>
                              {product.categoryNameEn}
                            </small>
                          </td>

                          <td>{product.price} BD</td>

                          <td>
                            <button
                              type="button"
                              className={
                                product.visible === false
                                  ? 'productHiddenButton'
                                  : 'productVisibleButton'
                              }
                              onClick={() =>
                                toggleProductVisibility(product)
                              }
                            >
                              {product.visible === false
                                ? 'مخفي'
                                : 'ظاهر'}
                            </button>
                          </td>

                          <td>
                            <div className="adminProductActions">
                              <button
                                type="button"
                                onClick={() =>
                                  openEditProduct(product)
                                }
                              >
                                تعديل
                              </button>

                              <button
                                type="button"
                                className="deleteProductButton"
                                onClick={() =>
                                  deleteProduct(product)
                                }
                              >
                                حذف
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </section>
      )}

      {view === 'categories' && showCategories && (
        <section className="adminCategoriesSection">
          <div className="adminCategoriesHeader">
            <div>
              <h2>إدارة الأقسام</h2>
              <p>إضافة وتعديل وحذف الأقسام.</p>
            </div>

            <div className="adminProductsHeaderButtons">
              <button
                type="button"
                onClick={openNewCategory}
              >
                + إضافة قسم
              </button>

              <button
                type="button"
                onClick={goToDashboard}
              >
                الرجوع للوحة الرئيسية
              </button>
            </div>
          </div>

          {error && (
            <div className="adminDashboardError">
              {error}
            </div>
          )}

          {categorySuccessMessage && (
            <p className="uploadSuccess">
              {categorySuccessMessage}
            </p>
          )}

          {showCategoryForm && (
            <form
              className="adminCategoryForm"
              onSubmit={saveCategory}
              ref={categoryFormRef}
            >
              <h3>
                {editingCategory
                  ? 'تعديل القسم'
                  : 'إضافة قسم جديد'}
              </h3>

              <div className="adminCategoryFormGrid">
                <label>
                  الاسم بالإنجليزي

                  <input
                    type="text"
                    value={categoryNameEn}
                    onChange={(event) =>
                      setCategoryNameEn(event.target.value)
                    }
                    required
                  />
                </label>

                <label>
                  الاسم بالعربي

                  <input
                    type="text"
                    value={categoryNameAr}
                    onChange={(event) =>
                      setCategoryNameAr(event.target.value)
                    }
                    required
                  />
                </label>

                <label>
                  الترتيب

                  <input
                    type="number"
                    min="1"
                    value={categoryOrder}
                    onChange={(event) =>
                      setCategoryOrder(event.target.value)
                    }
                  />
                </label>
              </div>

              <div className="adminCategoryFormButtons">
                <button
                  type="submit"
                  disabled={savingCategory}
                >
                  {savingCategory
                    ? 'جاري الحفظ...'
                    : 'حفظ القسم'}
                </button>

                <button
                  type="button"
                  className="cancelCategoryButton"
                  disabled={savingCategory}
                  onClick={() => {
                    setShowCategoryForm(false)
                    resetCategoryForm()
                  }}
                >
                  إلغاء
                </button>
              </div>
            </form>
          )}

          <div className="adminCategoriesList">
            {categories.length === 0 ? (
              <p>لا توجد أقسام حتى الآن</p>
            ) : (
              categories.map((category) => (
                <article
                  className="adminCategoryCard"
                  key={category.id}
                >
                  <div>
                    <h3>{category.nameEn}</h3>
                    <p>{category.nameAr}</p>
                    <small>
                      الترتيب: {category.order || 1}
                    </small>
                  </div>

                  <div className="adminCategoryActions">
                    <button
                      type="button"
                      onClick={() =>
                        openEditCategory(category)
                      }
                    >
                      تعديل
                    </button>

                    <button
                      type="button"
                      className="deleteCategoryButton"
                      onClick={() =>
                        deleteCategory(category)
                      }
                    >
                      حذف
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      )}
    </main>
  )
}

export default Admin
