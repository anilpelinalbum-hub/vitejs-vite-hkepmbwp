import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useApp } from "./contexts/AppContext";
import { useToast } from "./hooks/useToast";
import { isSafeUrl, sanitizeHTML } from "./utils/sanitize";
import LoadingSpinner from "./components/LoadingSpinner";

const LIST_URL = import.meta.env.VITE_LIST_URL;
const UPLOAD_URL = import.meta.env.VITE_UPLOAD_URL;

// Base64 encoded placeholder (1x1 transparent PNG)
const PLACEHOLDER_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

function uniqueBy(items, keyFn) {
  const map = new Map();
  for (const it of items) {
    const key = keyFn(it);
    if (!map.has(key)) map.set(key, it);
  }
  return Array.from(map.values());
}

// Sadece ismi çıkaran fonksiyon
const extractNameFromDescription = (description) => {
  if (!description) return '';
  
  // " — (isim)" formatını ara
  const nameMatch = description.match(/—\s*\(([^)]+)\)$/);
  if (nameMatch && nameMatch[1]) {
    return sanitizeHTML(nameMatch[1]);
  }
  
  return sanitizeHTML(description);
};

// Skeleton Loader bileşeni
const SkeletonLoader = ({ count, className }) => {
  return Array.from({ length: count }).map((_, i) => (
    <div
      key={i}
      className={`bg-white rounded-2xl shadow animate-pulse ${className}`}
    />
  ));
};

// Görüntü sıkıştırma utility fonksiyonu - SADECE VİDEOLAR İÇİN
const compressImage = async (file) => {
  // Fotoğrafları sıkıştırmadan doğrudan döndür
  if (!file.type.startsWith('video/')) {
    return file;
  }

  return new Promise((resolve) => {
    // Video dosyaları için orijinal dosyayı döndür
    resolve(file);
  });
};

// Lazy Image bileşeni
const LazyImage = React.memo(({ src, alt, className, onLoad, onError }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [imageSrc, setImageSrc] = useState(PLACEHOLDER_IMAGE);
  
  useEffect(() => {
    if (src && isSafeUrl(src)) {
      setImageSrc(src);
    }
  }, [src]);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = (e) => {
    e.target.src = PLACEHOLDER_IMAGE;
    setIsLoaded(true);
    onError?.();
  };

  return (
    <>
      {!isLoaded && (
        <div className={`skeleton ${className} bg-gray-200 animate-pulse`} />
      )}
      <img
        src={imageSrc}
        alt={alt}
        className={`${className} ${isLoaded ? 'block' : 'hidden'}`}
        loading="lazy"
        decoding="async"
        onLoad={handleLoad}
        onError={handleError}
      />
    </>
  );
});

LazyImage.displayName = 'LazyImage';

export default function NisanAlbum() {
  const { state, dispatch } = useApp();
  const { media, loading, isOnline } = state;
  const { addToast } = useToast();
  
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [note, setNote] = useState("");
  const [name, setName] = useState("");
  const [showSourceMenu, setShowSourceMenu] = useState(false);
  const [visibleItems, setVisibleItems] = useState(20);

  // Yükleme kuyruğu state'leri
  const [uploadQueue, setUploadQueue] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  const railRef = useRef(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const notePrompts = useMemo(
    () => [
      "✨ Anını daha özel kılmak için bir not ekle!",
      "💌 Fotoğrafına kalbinden geçenleri ekle, biz de okuyalım.",
      "📖 Anılar paylaştıkça güzelleşir, dilersen birkaç satır bırak.",
      "🌸 Bu kareye küçük bir hatıra yazısı eklemek ister misin?",
      "🎉 Fotoğrafını yükle, anını bizimle notunla paylaş!",
    ],
    []
  );
  const [randomPrompt, setRandomPrompt] = useState(notePrompts[0]);

  // Environment Variables doğrulama
  useEffect(() => {
    if (!LIST_URL || !UPLOAD_URL) {
      dispatch({ type: 'SET_ERROR', payload: "Sunucu bağlantı ayarları eksik. Lütfen daha sonra tekrar deneyin." });
    }
  }, [dispatch]);

  // Online durumunu izleme
  useEffect(() => {
    const handleOnline = () => dispatch({ type: 'SET_ONLINE_STATUS', payload: true });
    const handleOffline = () => dispatch({ type: 'SET_ONLINE_STATUS', payload: false });
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [dispatch]);

  // Analytics ve monitoring
  const logEvent = useCallback((eventName, params = {}) => {
    if (import.meta.env.PROD && UPLOAD_URL) {
      const analyticsData = {
        event: eventName,
        params: { 
          ...params, 
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          language: navigator.language 
        }
      };
      
      try {
        fetch(`${UPLOAD_URL}?analytics=1`, {
          method: 'POST',
          body: JSON.stringify(analyticsData)
        }).catch(() => {});
      } catch (e) {}
    }
  }, [UPLOAD_URL]);

  useEffect(() => {
    logEvent('page_view', { page_title: 'Nisan Albumu' });
  }, [logEvent]);

  // -------- LISTELEME --------
  const fetchList = useCallback(async () => {
    if (!LIST_URL) {
      dispatch({ type: 'SET_ERROR', payload: ".env içindeki VITE_LIST_URL eksik" });
      return;
    }
    try {
      dispatch({ type: 'CLEAR_ERROR' });
      
      // Cache busting için timestamp ekle
      const timestamp = new Date().getTime();
      const res = await fetch(`${LIST_URL}?t=${timestamp}`, { 
        cache: "no-store"
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const arrRaw = await res.json();
      const arr = Array.isArray(arrRaw)
        ? arrRaw
        : arrRaw.items || arrRaw.results || [];
      
      const normalized = arr.map((x) => ({
        id: x.id || x.fileId || x.url,
        name: x.name || "",
        mimeType: x.mimeType || "",
        url: x.url?.includes("https://") && isSafeUrl(x.url)
          ? x.url
          : x.id
          ? `https://drive.google.com/uc?export=view&id=${x.id}`
          : PLACEHOLDER_IMAGE,
        thumb: (x.thumb && isSafeUrl(x.thumb)) || (x.thumbnailLink && isSafeUrl(x.thumbnailLink)) ? x.thumb || x.thumbnailLink : null,
        createdTime: x.createdTime || x.modifiedTime || null,
        description: sanitizeHTML(x.description || ""),
        isVideo: x.isVideo || (x.mimeType || "").startsWith("video/")
      }));
      
      const uniq = uniqueBy(normalized, (i) => i.id || i.url);
      uniq.sort(
        (a, b) => new Date(b.createdTime || 0) - new Date(a.createdTime || 0)
      );
      dispatch({ type: 'SET_MEDIA', payload: uniq });
    } catch (e) {
      console.error("Listeleme hatası:", e);
      dispatch({ type: 'SET_ERROR', payload: "Liste alınamadı: " + e.message });
    }
  }, [dispatch]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // Sadece fotoğrafları filtrele
  const photosOnly = useMemo(() => 
    media.filter(item => !item.isVideo && !(item.mimeType || "").startsWith("video/")), 
    [media]
  );

  // Infinite scroll için daha fazla öğe yükleme
  const loadMore = useCallback(() => {
    setVisibleItems(prev => prev + 20);
  }, []);

  // Scroll izleme
  useEffect(() => {
    if (photosOnly.length <= visibleItems) return;
    
    const handleScroll = () => {
      if (window.innerHeight + document.documentElement.scrollTop >= document.documentElement.offsetHeight - 100) {
        loadMore();
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [photosOnly.length, visibleItems, loadMore]);

  // Mouse wheel ile yatay kaydırma
  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) {
        el.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Touch swipe desteği
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    let startX, scrollLeft;

    const handleTouchStart = (e) => {
      startX = e.touches[0].pageX - rail.offsetLeft;
      scrollLeft = rail.scrollLeft;
    };

    const handleTouchMove = (e) => {
      if (!startX) return;
      const x = e.touches[0].pageX - rail.offsetLeft;
      const walk = (x - startX) * 2;
      rail.scrollLeft = scrollLeft - walk;
    };

    rail.addEventListener('touchstart', handleTouchStart);
    rail.addEventListener('touchmove', handleTouchMove);

    return () => {
      rail.removeEventListener('touchstart', handleTouchStart);
      rail.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  // -------- YÜKLEME FONKSİYONLARI --------
  const readAsBase64 = useCallback((file) => {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(",")[1]);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }, []);

  // Tekil dosya yükleme
  const handleSingleUpload = useCallback(async (file, noteText, nameText) => {
    if (!UPLOAD_URL) {
      throw new Error("Yükleme URL'si eksik");
    }

    const data = await readAsBase64(file);
    const desc = noteText && nameText ? `${sanitizeHTML(noteText)} — (${sanitizeHTML(nameText)})` : sanitizeHTML(noteText || nameText || "");
    
    const response = await fetch(UPLOAD_URL, {
      method: "POST",
      body: JSON.stringify({ 
        files: [{ 
          name: file.name, 
          mimeType: file.type, 
          data, 
          note: desc 
        }] 
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Yükleme hatası");
    }

    return response.json();
  }, [readAsBase64]);

  // Yükleme kuyruğunu işle
  const processUploadQueue = useCallback(async () => {
    if (isUploading || uploadQueue.length === 0) return;
    
    setIsUploading(true);
    const currentItem = uploadQueue[0];
    
    try {
      await handleSingleUpload(currentItem.file, currentItem.note, currentItem.name);
      
      // Başarılı olursa kuyruktan kaldır
      setUploadQueue(prev => prev.slice(1));
      
      // Tüm yüklemeler tamamlandığında listeyi yenile ve başarı toast'ını göster
      if (uploadQueue.length === 1) {
        await fetchList(); // Listeyi yenile
        addToast("Yükleme başarılı!", "success");
      }
      
    } catch (error) {
      console.error('Yükleme hatası:', error);
      addToast("Yükleme başarısız: " + error.message, "error");
      setUploadQueue(prev => prev.slice(1));
    } finally {
      setIsUploading(false);
    }
  }, [isUploading, uploadQueue, handleSingleUpload, fetchList, addToast]);

  // Kuyruk değiştiğinde işlemi tetikle
  useEffect(() => {
    if (uploadQueue.length > 0 && !isUploading) {
      processUploadQueue();
    }
  }, [uploadQueue, isUploading, processUploadQueue]);

  const handleFileSelect = useCallback(async (e) => {
    const files = Array.from(e.target.files || []);
    const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;
    const ALLOWED_TYPES = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/quicktime', 'video/x-msvideo'
    ];

    const validFiles = files.filter(file => {
      const isValidType = ALLOWED_TYPES.includes(file.type);
      const isValidSize = file.size <= MAX_FILE_SIZE;
      return isValidType && isValidSize;
    });
    
    if (validFiles.length !== files.length) {
      dispatch({ type: 'SET_ERROR', payload: "Bazı dosyalar desteklenmiyor (JPEG, PNG, GIF, WebP, MP4, MOV, AVI) veya boyut limitini aşıyor (max 2GB)" });
    }
    
    if (validFiles.length === 0) return;
    
    // Görüntüleri sıkıştır (sadece videolar için)
    const processedFiles = await Promise.all(
      validFiles.map(async (file) => {
        if (file.type.startsWith('video/')) {
          try {
            return await compressImage(file);
          } catch (error) {
            console.warn('Video sıkıştırma hatası:', error);
            return file;
          }
        }
        return file;
      })
    );

    if (!isOnline) {
      const offlineUploads = JSON.parse(localStorage.getItem('offlineUploads') || '[]');
      
      processedFiles.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          offlineUploads.push({
            name: file.name,
            type: file.type,
            data: e.target.result.split(',')[1],
            note: '',
            userName: '',
            timestamp: new Date().getTime()
          });
          localStorage.setItem('offlineUploads', JSON.stringify(offlineUploads));
        };
        reader.readAsDataURL(file);
      });
      
      addToast("Çevrimdışı mod: Dosyalar senkronize edilecek", "success");
      setShowNoteModal(false);
      return;
    }
    
    setPendingFiles(processedFiles);
    setRandomPrompt(notePrompts[Math.floor(Math.random() * notePrompts.length)]);
    setShowNoteModal(true);
    e.target.value = "";
  }, [isOnline, notePrompts, addToast, dispatch]);

  // Çevrimdışı yüklemeleri senkronize etme
  useEffect(() => {
    if (isOnline && UPLOAD_URL) {
      const offlineUploads = JSON.parse(localStorage.getItem('offlineUploads') || '[]');
      if (offlineUploads.length > 0) {
        syncOfflineUploads(offlineUploads);
      }
    }
  }, [isOnline]);

  const syncOfflineUploads = async (uploads) => {
    for (const upload of uploads) {
      try {
        await fetch(UPLOAD_URL, {
          method: "POST",
          body: JSON.stringify({ 
            files: [{ 
              name: upload.name, 
              mimeType: upload.type, 
              data: upload.data,
              note: upload.note
            }] 
          }),
        });
      } catch (error) {
        console.error("Çevrimdışı yükleme senkronizasyon hatası:", error);
        break;
      }
    }
    
    localStorage.setItem('offlineUploads', '[]');
    fetchList();
    addToast("Çevrimdışı yüklemeler senkronize edildi", "success");
  };

  const handleUpload = useCallback(async () => {
    if (!pendingFiles.length) return;
    if (!UPLOAD_URL) {
      dispatch({ type: 'SET_ERROR', payload: ".env içindeki VITE_UPLOAD_URL eksik" });
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    dispatch({ type: 'CLEAR_ERROR' });

    try {
      // Kuyruğa ekle
      setUploadQueue(prev => [
        ...prev,
        ...pendingFiles.map(file => ({
          file,
          note,
          name
        }))
      ]);

      // Modal'ı hemen kapat
      setShowNoteModal(false);
      setNote("");
      setName("");
      setPendingFiles([]);
      
      addToast("Yüklemeler kuyruğa alındı", "success");
      logEvent('upload_started', { file_count: pendingFiles.length });
      
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err.message || "Yüklenemedi" });
      addToast("Yükleme hatası: " + err.message, "error");
      logEvent('upload_error', { error: err.message });
      setShowNoteModal(false);
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 500);
    }
  }, [pendingFiles, note, name, logEvent, addToast, dispatch]);

  // Optimize edilmiş görüntü URL'si
  const getOptimizedImageUrl = useCallback((url, width = 500) => {
    if (!url.includes('drive.google.com')) return url;
    
    const id = url.match(/id=([^&]+)/)?.[1];
    if (!id) return url;
    
    // WebP formatını destekleyen tarayıcılar için
    const supportsWebP = !![].map && document.createElement('canvas').toDataURL('image/webp').indexOf('data:image/webp') === 0;
    const format = supportsWebP ? 'webp' : 'jpg';
    
    return `https://drive.google.com/thumbnail?id=${id}&sz=w${width}&format=${format}`;
  }, []);

  // Media Item bileşeni
  const MediaItem = React.memo(({ item }) => {
    const displayName = extractNameFromDescription(item.description);
    const optimizedUrl = getOptimizedImageUrl(item.thumb || item.url);
    
    return (
      <motion.a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        whileHover={{ y: -4 }}
        className="album-item relative w-[160px] h-[160px] rounded-2xl overflow-hidden bg-white shadow flex-shrink-0 snap-start will-change-transform"
        aria-label={displayName || "Fotoğraf"}
      >
        <LazyImage
          src={optimizedUrl}
          alt={displayName || ""}
          className="w-full h-full object-cover"
        />
        {displayName && (
          <div 
            className="absolute bottom-0 left-0 right-0 p-2 text-xs bg-gradient-to-t from-black/60 to-transparent text-white line-clamp-2"
          >
            {displayName}
          </div>
        )}
      </motion.a>
    );
  }, (prevProps, nextProps) => {
    return prevProps.item.id === nextProps.item.id && 
           prevProps.item.description === nextProps.item.description;
  });

  MediaItem.displayName = 'MediaItem';

  return (
    <div className="min-h-screen py-10 px-4 bg-gradient-to-b from-pink-50 to-white">
      {/* Yükleme durumu için detaylı geri bildirim */}
      {(uploading || isUploading) && (
        <div className="fixed bottom-4 right-4 bg-white p-4 rounded-lg shadow-lg z-50">
          <div className="flex items-center gap-3">
            <LoadingSpinner size="small" />
            <div>
              <p className="text-sm font-medium">Yükleniyor...</p>
              <p className="text-xs text-gray-500">
                {uploadQueue.length > 0 ? `Kuyrukta: ${uploadQueue.length}` : `${uploadProgress}% tamamlandı`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Başlık */}
      <motion.div
        className="max-w-4xl mx-auto text-center"
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h1 className="text-4xl md:text-6xl font-extrabold leading-tight text-rose-600 drop-shadow-sm">
          Anıl & Pelin'in <br className="hidden md:block" />
          Nişan Albümü ✨
        </h1>
        <p className="mt-4 text-base md:text-lg text-neutral-700">
          Fotoğraf veya videolarınızı yükleyin, anılarımızı paylaşalım 📸
        </p>

        {!isOnline && (
          <div className="mt-3 p-2 bg-yellow-100 text-yellow-800 rounded-lg text-sm">
          ⚠️ Çevrimdışı modundasınız. Yüklemeler internet bağlantınız geri geldiğinde devam edecek.
          </div>
        )}

        {state.error && (
          <div className="max-w-4xl mx-auto mt-4 p-3 bg-red-100 text-red-700 rounded-lg">
            ❌ {state.error}
          </div>
        )}

        {/* Yükleme butonu */}
        <button
          onClick={() => setShowSourceMenu(true)}
          disabled={uploading || isUploading}
          className="inline-flex items-center justify-center gap-2 mt-6 px-6 py-3 rounded-full text-white bg-rose-500 hover:bg-rose-600 shadow-lg cursor-pointer transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Fotoğraf veya video yükle"
          aria-haspopup="dialog"
        >
          {(uploading || isUploading) ? "Yükleniyor…" : "📤 Fotoğraf / Video Yükle"}
        </button>
      </motion.div>

      {/* Kaynak seçim menüsü */}
      {showSourceMenu && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-semibold text-rose-600 text-center mb-4">
              Dosya Kaynağı Seç
            </h3>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  setShowSourceMenu(false);
                  fileInputRef.current?.click();
                }}
                className="py-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white transition-colors"
              >
                📂 Galeri / Dosyalar
              </button>
              <button
                onClick={() => {
                  setShowSourceMenu(false);
                  cameraInputRef.current?.click();
                }}
                className="py-3 rounded-xl bg-rose-400 hover:bg-rose-500 text-white transition-colors"
              >
                📷 Kamera ile Çek
              </button>
              <button
                onClick={() => setShowSourceMenu(false)}
                className="py-3 rounded-xl bg-gray-200 hover:bg-gray-300 transition-colors"
              >
                İptal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gizli inputlar */}
      <input
        type="file"
        accept="image/*,video/*"
        multiple
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileSelect}
      />
      <input
        type="file"
        accept="image/*,video/*"
        capture="environment"
        ref={cameraInputRef}
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* ---- ÇERÇEVE: Son Yüklenenler ---- */}
      <section className="max-w-4xl mx-auto mt-14 px-2">
        {loading ? (
          <div className="grid justify-center gap-3 [grid-template-columns:repeat(2,200px)] md:[grid-template-columns:repeat(2,250px)]">
            <SkeletonLoader count={4} className="w-full aspect-square" />
          </div>
        ) : photosOnly.length > 0 ? (
          <div className="grid justify-center gap-3 [grid-template-columns:repeat(2,200px)] md:[grid-template-columns:repeat(2,250px)]">
            {photosOnly.slice(0, 4).map((m) => {
              const displayName = extractNameFromDescription(m.description);
              const optimizedUrl = getOptimizedImageUrl(m.thumb || m.url);
              
              return (
                <motion.a
                  key={m.id}
                  href={m.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.02 }}
                  className="relative w-full aspect-square overflow-hidden rounded-2xl bg-white shadow group will-change-transform"
                  aria-label={displayName || "Fotoğraf"}
                >
                  <LazyImage
                    src={optimizedUrl}
                    alt={displayName || ""}
                    className="w-full h-full object-cover"
                  />
                  {displayName && (
                    <div className="absolute bottom-0 left-0 right-0 p-2 text-xs bg-gradient-to-t from-black/60 to-transparent text-white line-clamp-2">
                      {displayName}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                </motion.a>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-10">
            <div className="text-6xl mb-4">📸</div>
            <p className="text-gray-500 text-lg">Henüz hiç fotoğraf yüklenmemiş. İlk fotoğrafı sen yüklemek ister misin?</p>
          </div>
        )}
      </section>

      {/* ---- ALBÜM: Yatay Strip ---- */}
      <section className="max-w-6xl mx-auto mt-14 px-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg md:text-xl font-semibold text-rose-600">
            Albüm
          </h2>
          <span className="text-sm text-gray-500">{photosOnly.length} fotoğraf</span>
        </div>

        {loading ? (
          <div className="flex gap-3 overflow-x-auto pb-4">
            <SkeletonLoader count={6} className="w-[160px] h-[160px] flex-shrink-0" />
          </div>
        ) : photosOnly.length > 0 ? (
          <div className="overflow-x-auto scroll-smooth snap-x snap-mandatory no-scrollbar">
            <div ref={railRef} className="album-strip flex gap-3 pb-4">
              {photosOnly.slice(0, visibleItems).map((m) => (
                <MediaItem key={m.id} item={m} />
              ))}
            </div>
            {visibleItems < photosOnly.length && (
              <div className="text-center mt-4">
                <button 
                  onClick={loadMore}
                  className="px-4 py-2 bg-rose-100 text-rose-600 rounded-full hover:bg-rose-200 transition-colors"
                >
                  Daha fazla yükle
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 bg-white rounded-2xl shadow-card">
            <div className="text-5xl mb-3">🌟</div>
            <p className="text-gray-500">Burada henüz hiç fotoğraf yok. İlk olmak için hemen bir fotoğraf yükle!</p>
          </div>
        )}
      </section>

      {/* NOT + İSİM MODAL */}
      {showNoteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 shadow-xl w-full max-w-md">
            <h3 className="text-lg font-semibold text-rose-600 text-center mb-4">
              {randomPrompt}
            </h3>

            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Notunuzu buraya yazın (opsiyonel)"
              className="w-full border rounded-xl p-3 min-h-[90px] focus:ring-2 focus:ring-rose-400 outline-none mb-3"
              maxLength={500}
            />

            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Adınızı yazın (opsiyonel)"
              className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-rose-400 outline-none"
              maxLength={50}
            />

            {/* Progress bar */}
            {uploading && (
              <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
                <div
                  className="bg-rose-500 h-2 rounded-full transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}

            <div className="flex justify-between gap-3 mt-4">
              <button
                onClick={() => {
                  setShowNoteModal(false);
                  setPendingFiles([]);
                  setNote("");
                  setName("");
                }}
                className="flex-1 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 transition-colors disabled:opacity-50"
                disabled={uploading}
              >
                İptal
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="flex-1 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white transition-colors disabled:opacity-50"
              >
                {uploading ? "Yükleniyor..." : "Gönder"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}