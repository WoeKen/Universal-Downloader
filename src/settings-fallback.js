/**
 * Global Unhandled Exception & Rejection Handlers
 */
window.addEventListener('error', event => {
  const toast = document.getElementById('toast');
  if (toast) {
    toast.textContent = event.message || '系统运行发生异常';
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 3000);
  }
});

window.addEventListener('unhandledrejection', event => {
  const toast = document.getElementById('toast');
  if (toast) {
    toast.textContent = event.reason?.message || '请求处理异常';
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 3000);
  }
});
