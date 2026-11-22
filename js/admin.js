import { supabase } from './supabase.js';

const loginSection = document.getElementById('login-section');
const crudSection = document.getElementById('crud-section');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const adminError = document.getElementById('admin-error');
const logoutBtn = document.getElementById('logout-btn');

const productForm = document.getElementById('product-form');
const productIdInput = document.getElementById('product-id');
const pSkuInput = document.getElementById('p-sku');
const pNameInput = document.getElementById('p-name');
const pDescriptionInput = document.getElementById('p-description');
const pCategoryInput = document.getElementById('p-category');
const pPriceInput = document.getElementById('p-price');
const pImageInput = document.getElementById('p-image');
const pImagesInput = document.getElementById('p-images');
const pStatusInput = document.getElementById('p-status');
const formSubmitBtn = document.getElementById('form-submit-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const adminTableBody = document.getElementById('admin-table-body');

let productsList = [];

document.addEventListener('DOMContentLoaded', initializeAdmin);

async function initializeAdmin() {
  setupAdminListeners();

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    showLoginError(`No se pudo verificar la sesión: ${error.message}`);
    return;
  }

  setAdminVisibility(Boolean(data.session));
  if (data.session) {
    await loadAdminProducts();
  }
}

function setAdminVisibility(isAuthenticated) {
  loginSection.style.display = isAuthenticated ? 'none' : 'block';
  crudSection.style.display = isAuthenticated ? 'block' : 'none';
  logoutBtn.style.display = isAuthenticated ? 'inline-block' : 'none';
}

function setupAdminListeners() {
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    showLoginError('');

    const email = document.getElementById('admin-user').value.trim();
    const password = document.getElementById('admin-password').value;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      showLoginError(`No se pudo iniciar sesión: ${error.message}`);
      return;
    }

    document.getElementById('admin-password').value = '';
    setAdminVisibility(Boolean(data.session));
    await loadAdminProducts();
  });

  logoutBtn.addEventListener('click', async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      showAdminError(`No se pudo cerrar sesión: ${error.message}`);
      return;
    }

    productsList = [];
    renderAdminTable();
    showAdminError('');
    setAdminVisibility(false);
  });

  productForm.addEventListener('submit', handleFormSubmit);
  cancelEditBtn.addEventListener('click', resetForm);

  adminTableBody.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    if (button.dataset.action === 'edit') {
      editProduct(button.dataset.id);
    } else if (button.dataset.action === 'delete') {
      deleteProduct(button.dataset.id);
    }
  });
}

async function loadAdminProducts() {
  let { data, error } = await supabase
    .from('products')
    .select('id, sku, name, description, category, price, image, images, status')
    .order('created_at', { ascending: true });

  if (error && (error.code === '42703' || /description|images/i.test(error.message))) {
    ({ data, error } = await supabase
      .from('products')
      .select('id, sku, name, category, price, image, status')
      .order('created_at', { ascending: true }));
  }

  if (error) {
    showAdminError(`No se pudo cargar el catálogo: ${error.message}`);
    return;
  }

  productsList = data;
  showAdminError('');
  renderAdminTable();
}

function renderAdminTable() {
  adminTableBody.replaceChildren();

  productsList.forEach((product) => {
    const row = document.createElement('tr');
    const skuCell = document.createElement('td');
    const imageCell = document.createElement('td');
    const nameCell = document.createElement('td');
    const categoryCell = document.createElement('td');
    const priceCell = document.createElement('td');
    const statusCell = document.createElement('td');
    const actionsCell = document.createElement('td');
    const sku = document.createElement('strong');
    const image = document.createElement('img');
    const status = document.createElement('span');

    sku.textContent = product.sku;
    image.src = product.image;
    image.alt = product.name;
    image.style.cssText = 'width: 40px; height: 40px; object-fit: cover; border-radius: 4px;';
    nameCell.textContent = product.name;
    categoryCell.textContent = product.category;
    priceCell.textContent = `$${Number(product.price).toFixed(2)} MXN`;
    status.className = `stock-badge ${product.status === 'Disponible' ? 'disponible' : 'agotado'}`;
    status.textContent = product.status;

    skuCell.appendChild(sku);
    imageCell.appendChild(image);
    statusCell.appendChild(status);
    actionsCell.append(
      createActionButton('Editar', 'edit', product.id, 'btn-primary'),
      createActionButton('Eliminar', 'delete', product.id, 'btn-danger')
    );
    row.append(skuCell, imageCell, nameCell, categoryCell, priceCell, statusCell, actionsCell);
    adminTableBody.appendChild(row);
  });
}

function createActionButton(label, action, id, className) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  button.dataset.action = action;
  button.dataset.id = id;
  button.style.cssText = 'padding: 0.3rem 0.6rem; font-size: 0.8rem; margin-right: 0.4rem;';
  return button;
}

async function handleFormSubmit(event) {
  event.preventDefault();
  showAdminError('');

  const id = productIdInput.value;
  const existingProduct = productsList.find((item) => item.id === id);
  const sku = pSkuInput.value.trim();
  const files = Array.from(pImagesInput.files || []);
  const uploadedPaths = [];
  formSubmitBtn.disabled = true;

  try {
    const uploadedUrls = await uploadProductImages(files, sku, uploadedPaths);
    const image = pImageInput.value.trim() || uploadedUrls[0] || existingProduct?.image;

    if (!image) {
      throw new Error('Agrega una URL de imagen principal o sube al menos una foto.');
    }

    const product = {
      sku,
      name: pNameInput.value.trim(),
      description: pDescriptionInput.value.trim(),
      category: pCategoryInput.value,
      price: Number(pPriceInput.value),
      image,
      images: [...new Set([...(existingProduct?.images || []), ...uploadedPaths])],
      status: pStatusInput.value
    };

    let query = id
      ? supabase.from('products').update(product).eq('id', id)
      : supabase.from('products').insert(product);
    let { error } = await query;

    if (error && (error.code === '42703' || /description|images/i.test(error.message))) {
      const { description, images, ...baselineProduct } = product;
      if (uploadedUrls.length > 0) baselineProduct.image = uploadedUrls[0];
      query = id
        ? supabase.from('products').update(baselineProduct).eq('id', id)
        : supabase.from('products').insert(baselineProduct);
      ({ error } = await query);
    }

    if (error) {
      const cleanupMessage = await removeUploadedImages(uploadedPaths);
      showAdminError(`No se pudo guardar el producto: ${error.message}${cleanupMessage}`);
      return;
    }

    resetForm();
    await loadAdminProducts();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const cleanupMessage = await removeUploadedImages(uploadedPaths);
    showAdminError(`No se pudo guardar el producto: ${message}${cleanupMessage}`);
  } finally {
    formSubmitBtn.disabled = false;
  }
}

async function uploadProductImages(files, sku, uploadedPaths) {
  const uploadedUrls = [];
  const safeSku = sku.replace(/[^a-zA-Z0-9_-]/g, '-');

  for (const file of files) {
    if (!file.type.startsWith('image/')) {
      throw new Error(`El archivo "${file.name}" no es una imagen válida.`);
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
    const path = `${safeSku}/${crypto.randomUUID()}-${safeName}`;
    const { error } = await supabase.storage
      .from('product-images')
      .upload(path, file, { contentType: file.type, upsert: false });

    if (error) throw error;

    uploadedPaths.push(path);
    const { data } = supabase.storage.from('product-images').getPublicUrl(path);
    uploadedUrls.push(data.publicUrl);
  }

  return uploadedUrls;
}

async function removeUploadedImages(paths) {
  if (paths.length === 0) return '';

  try {
    const { error } = await supabase.storage.from('product-images').remove(paths);
    return error
      ? ` No se pudieron limpiar las fotos subidas: ${error.message}`
      : '';
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return ` No se pudieron limpiar las fotos subidas: ${message}`;
  }
}

function editProduct(id) {
  const product = productsList.find((item) => item.id === id);
  if (!product) return;

  productIdInput.value = product.id;
  pSkuInput.value = product.sku;
  pSkuInput.disabled = true;
  pNameInput.value = product.name;
  pDescriptionInput.value = product.description || '';
  pCategoryInput.value = product.category;
  pPriceInput.value = product.price;
  pImageInput.value = product.image;
  pStatusInput.value = product.status;

  formSubmitBtn.textContent = 'Actualizar Producto';
  cancelEditBtn.style.display = 'inline-block';
}

async function deleteProduct(id) {
  const product = productsList.find((item) => item.id === id);
  if (!product || !confirm(`¿Estás seguro de que deseas eliminar el producto con SKU: ${product.sku}?`)) {
    return;
  }

  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) {
    showAdminError(`No se pudo eliminar el producto: ${error.message}`);
    return;
  }

  const cleanupMessage = await removeUploadedImages(product.images || []);
  await loadAdminProducts();
  if (cleanupMessage) showAdminError(`El producto se eliminó.${cleanupMessage}`);
}

function resetForm() {
  productForm.reset();
  productIdInput.value = '';
  pSkuInput.disabled = false;
  formSubmitBtn.textContent = 'Guardar Producto';
  cancelEditBtn.style.display = 'none';
}

function showLoginError(message) {
  loginError.textContent = message;
}

function showAdminError(message) {
  adminError.textContent = message;
}
