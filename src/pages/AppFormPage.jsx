import { ArrowLeft, Eye, ImagePlus, Save, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CATEGORIES, getCategoryLabel } from '../data/categories';
import { DEFAULT_DEVELOPER, PUBLIC_STORE_URL } from '../config';
import { createApp, getApp, updateApp } from '../services/appsService';
import { formatNumber, formatRating } from '../utils/formatters';
import { createSlug } from '../utils/slug';

const initialForm = {
  title: '',
  slug: '',
  categoryKey: 'educacion',
  shortDescription: '',
  fullDescription: '',
  iconUrl: '',
  bannerUrl: '',
  screenshots: '',
  playStoreUrl: '',
  privacyPolicyUrl: '',
  packageName: '',
  appSize: '',
  operatingSystem: 'Android',
  minAndroidVersion: '',
  currentVersion: '',
  lastUpdate: '',
  languages: '',
  offlineUse: 'No',
  containsAds: 'No',
  inAppPurchases: 'No',
  ageRating: '',
  price: 'Gratis',
  developer: DEFAULT_DEVELOPER,
  status: 'draft',
};

export default function AppFormPage({ mode }) {
  const isEdit = mode === 'edit';
  const { appId } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [originalApp, setOriginalApp] = useState(null);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!isEdit) return;

    let mounted = true;
    getApp(appId)
      .then((app) => {
        if (!mounted) return;
        setOriginalApp(app);
        setForm({
          title: app.title || '',
          slug: app.slug || '',
          categoryKey: app.categoryKey || 'otros',
          shortDescription: app.shortDescription || '',
          fullDescription: app.fullDescription || '',
          iconUrl: app.iconUrl || '',
          bannerUrl: app.bannerUrl || '',
          screenshots: Array.isArray(app.screenshots) ? app.screenshots.join('\n') : '',
          playStoreUrl: app.playStoreUrl || app.downloadUrl || '',
          privacyPolicyUrl: app.privacyPolicyUrl || '',
          packageName: app.packageName || '',
          appSize: app.appSize || '',
          operatingSystem: app.operatingSystem || 'Android',
          minAndroidVersion: app.minAndroidVersion || '',
          currentVersion: app.currentVersion || '',
          lastUpdate: app.lastUpdate || '',
          languages: app.languages || '',
          offlineUse: app.offlineUse || 'No',
          containsAds: app.containsAds || 'No',
          inAppPurchases: app.inAppPurchases || 'No',
          ageRating: app.ageRating || '',
          price: app.price || 'Gratis',
          developer: app.developer || DEFAULT_DEVELOPER,
          status: app.status || 'draft',
        });
      })
      .catch((err) => setMessage(err.message || 'No se pudo cargar la app.'))
      .finally(() => setLoading(false));

    return () => { mounted = false; };
  }, [appId, isEdit]);

  const screenshotsPreview = useMemo(() => {
    return form.screenshots
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
  }, [form.screenshots]);

  const handleChange = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: '' }));
  };

  const handleTitleChange = (value) => {
    setForm((current) => ({
      ...current,
      title: value,
      slug: current.slug ? current.slug : createSlug(value),
    }));
  };

  const regenerateSlug = () => {
    handleChange('slug', createSlug(form.title));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setErrors({});

    try {
      if (isEdit) {
        await updateApp(appId, form);
        setMessage('Cambios guardados correctamente.');
      } else {
        const result = await createApp(form);
        navigate(`/apps/${result.id}/edit`, { replace: true });
      }
    } catch (err) {
      if (err.fields) setErrors(err.fields);
      setMessage(err.message || 'No se pudo guardar la app.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="loader-card surface"><span className="loader" /> Cargando formulario...</div>;
  }

  return (
    <form className="page-stack" onSubmit={handleSubmit}>
      <section className="section-header spacious">
        <div>
          <Link className="back-link" to="/apps"><ArrowLeft size={17} /> Volver a apps</Link>
          <span className="eyebrow">{isEdit ? 'Editar app' : 'Nueva app'}</span>
          <h2>{isEdit ? form.title || 'Editar app' : 'Crear nueva app'}</h2>
          <p>Completa la información que se mostrará en la página pública de la tienda.</p>
        </div>
        <div className="header-actions">
          {form.slug && <a className="ghost-button" href={`${PUBLIC_STORE_URL}/app/${form.slug}`} target="_blank" rel="noreferrer"><Eye size={17} /> Vista pública</a>}
          <button className="primary-button" disabled={saving} type="submit">
            <Save size={18} />
            {saving ? 'Guardando...' : 'Guardar app'}
          </button>
        </div>
      </section>

      {message && <div className={`alert ${Object.keys(errors).length ? 'error' : 'success'}`}>{message}</div>}

      {isEdit && originalApp && (
        <section className="stats-grid compact">
          <article className="stat-card"><span>Me gusta</span><strong>{formatNumber(originalApp.likesCount)}</strong><small>Solo lectura</small></article>
          <article className="stat-card"><span>Descargas</span><strong>{formatNumber(originalApp.downloadsCount)}</strong><small>Clics hacia Play Store</small></article>
          <article className="stat-card"><span>Valoración</span><strong>⭐ {formatRating(originalApp)}</strong><small>{formatNumber(originalApp.ratingCount)} votos</small></article>
          <article className="stat-card"><span>Comentarios</span><strong>{formatNumber(originalApp.commentsCount)}</strong><small>Aprobados</small></article>
        </section>
      )}

      <div className="form-grid">
        <section className="surface form-section">
          <div className="section-title">
            <Sparkles size={19} />
            <h3>Información principal</h3>
          </div>

          <div className="fields-grid two">
            <Field label="Nombre de la app" error={errors.title} required>
              <input value={form.title} onChange={(event) => handleTitleChange(event.target.value)} placeholder="Ejemplo: Biblia Universal" />
            </Field>
            <Field label="Slug público" error={errors.slug} required>
              <div className="inline-field">
                <input value={form.slug} onChange={(event) => handleChange('slug', createSlug(event.target.value))} placeholder="biblia-universal" />
                <button className="ghost-button small" type="button" onClick={regenerateSlug}>Generar</button>
              </div>
            </Field>
          </div>

          <div className="fields-grid two">
            <Field label="Categoría" required>
              <select value={form.categoryKey} onChange={(event) => handleChange('categoryKey', event.target.value)}>
                {CATEGORIES.map((category) => <option key={category.key} value={category.key}>{category.label}</option>)}
              </select>
            </Field>
            <Field label="Estado">
              <select value={form.status} onChange={(event) => handleChange('status', event.target.value)}>
                <option value="draft">Oculta / borrador</option>
                <option value="published">Publicada</option>
              </select>
            </Field>
          </div>

          <Field label="Descripción corta" error={errors.shortDescription} required>
            <textarea rows="3" value={form.shortDescription} onChange={(event) => handleChange('shortDescription', event.target.value)} placeholder="Resumen corto para la tarjeta de la app." />
          </Field>

          <Field label="Descripción completa" error={errors.fullDescription} required>
            <textarea rows="9" value={form.fullDescription} onChange={(event) => handleChange('fullDescription', event.target.value)} placeholder="Descripción completa que aparecerá en la página detallada." />
          </Field>
        </section>

        <aside className="surface preview-panel">
          <span className="eyebrow">Vista rápida</span>
          <div className="app-preview-card">
            {form.bannerUrl ? <img className="preview-banner" src={form.bannerUrl} alt="Banner" /> : <div className="preview-banner empty"><ImagePlus size={26} /> Banner</div>}
            <div className="preview-info">
              {form.iconUrl ? <img className="preview-icon" src={form.iconUrl} alt="Icono" /> : <div className="preview-icon empty">AS</div>}
              <div>
                <h3>{form.title || 'Nombre de la app'}</h3>
                <p>{getCategoryLabel(form.categoryKey)}</p>
              </div>
            </div>
            <p>{form.shortDescription || 'Aquí se verá la descripción corta de la app.'}</p>
          </div>
        </aside>
      </div>

      <section className="surface form-section">
        <div className="section-title"><ImagePlus size={19} /><h3>Imágenes por URL</h3></div>
        <div className="fields-grid two">
          <Field label="Icono URL" error={errors.iconUrl} required>
            <input value={form.iconUrl} onChange={(event) => handleChange('iconUrl', event.target.value)} placeholder="https://raw.githubusercontent.com/.../icon.png" />
          </Field>
          <Field label="Banner URL">
            <input value={form.bannerUrl} onChange={(event) => handleChange('bannerUrl', event.target.value)} placeholder="https://raw.githubusercontent.com/.../banner.png" />
          </Field>
        </div>
        <Field label="Capturas de pantalla" hint="Pega una URL por línea. Se mostrarán en carrusel/grilla en la página pública.">
          <textarea rows="6" value={form.screenshots} onChange={(event) => handleChange('screenshots', event.target.value)} placeholder={'https://raw.githubusercontent.com/.../screenshot-1.png\nhttps://raw.githubusercontent.com/.../screenshot-2.png'} />
        </Field>

        {screenshotsPreview.length > 0 && (
          <div className="screenshot-strip">
            {screenshotsPreview.map((url) => <img src={url} alt="Captura" key={url} />)}
          </div>
        )}
      </section>

      <section className="surface form-section">
        <div className="section-title"><Save size={19} /><h3>Datos técnicos y enlaces</h3></div>
        <div className="fields-grid two">
          <Field label="Enlace de Google Play" error={errors.playStoreUrl} required>
            <input value={form.playStoreUrl} onChange={(event) => handleChange('playStoreUrl', event.target.value)} placeholder="https://play.google.com/store/apps/details?id=..." />
          </Field>
          <Field label="Política de privacidad de la app" error={errors.privacyPolicyUrl} required>
            <input value={form.privacyPolicyUrl} onChange={(event) => handleChange('privacyPolicyUrl', event.target.value)} placeholder="https://..." />
          </Field>
          <Field label="Package name">
            <input value={form.packageName} onChange={(event) => handleChange('packageName', event.target.value)} placeholder="com.appsmarttechnology.app" />
          </Field>
          <Field label="Tamaño">
            <input value={form.appSize} onChange={(event) => handleChange('appSize', event.target.value)} placeholder="25 MB" />
          </Field>
          <Field label="Sistema operativo">
            <input value={form.operatingSystem} onChange={(event) => handleChange('operatingSystem', event.target.value)} placeholder="Android" />
          </Field>
          <Field label="Android requerido">
            <input value={form.minAndroidVersion} onChange={(event) => handleChange('minAndroidVersion', event.target.value)} placeholder="Android 7.0 o superior" />
          </Field>
          <Field label="Versión actual">
            <input value={form.currentVersion} onChange={(event) => handleChange('currentVersion', event.target.value)} placeholder="1.0.0" />
          </Field>
          <Field label="Última actualización">
            <input value={form.lastUpdate} onChange={(event) => handleChange('lastUpdate', event.target.value)} placeholder="12 de julio de 2026" />
          </Field>
          <Field label="Idiomas">
            <input value={form.languages} onChange={(event) => handleChange('languages', event.target.value)} placeholder="Español, Inglés, Portugués" />
          </Field>
          <Field label="Uso sin conexión">
            <select value={form.offlineUse} onChange={(event) => handleChange('offlineUse', event.target.value)}>
              <option value="Sí">Sí</option>
              <option value="No">No</option>
            </select>
          </Field>
          <Field label="Contiene anuncios">
            <select value={form.containsAds} onChange={(event) => handleChange('containsAds', event.target.value)}>
              <option value="Sí">Sí</option>
              <option value="No">No</option>
            </select>
          </Field>
          <Field label="Compras dentro de la app">
            <select value={form.inAppPurchases} onChange={(event) => handleChange('inAppPurchases', event.target.value)}>
              <option value="Sí">Sí</option>
              <option value="No">No</option>
            </select>
          </Field>
          <Field label="Clasificación por edad">
            <input value={form.ageRating} onChange={(event) => handleChange('ageRating', event.target.value)} placeholder="Para todos" />
          </Field>
          <Field label="Precio">
            <input value={form.price} onChange={(event) => handleChange('price', event.target.value)} placeholder="Gratis o S/ 9.90" />
          </Field>
          <Field label="Desarrollador">
            <input value={form.developer} onChange={(event) => handleChange('developer', event.target.value)} placeholder="AppsMart Technology" />
          </Field>
        </div>
      </section>

      <div className="bottom-actions">
        <Link className="ghost-button" to="/apps">Cancelar</Link>
        <button className="primary-button" disabled={saving} type="submit"><Save size={18} /> {saving ? 'Guardando...' : 'Guardar app'}</button>
      </div>
    </form>
  );
}

function Field({ label, children, error, hint, required }) {
  return (
    <label className="field">
      <span>{label}{required && <em>*</em>}</span>
      {children}
      {hint && <small>{hint}</small>}
      {error && <strong className="field-error">{error}</strong>}
    </label>
  );
}
