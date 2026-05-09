document.addEventListener('DOMContentLoaded', () => {
  const openMainBtn = document.getElementById('open-main');

  if (openMainBtn) {
    openMainBtn.addEventListener('click', () => {
      Utils.openMainPage();
    });
  }

  Utils.log('Side panel initialized');
});
