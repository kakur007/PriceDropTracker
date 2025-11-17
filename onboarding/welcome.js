document.addEventListener('DOMContentLoaded', () => {
  const getStartedBtn = document.getElementById('getStartedBtn');
  if (getStartedBtn) {
    getStartedBtn.addEventListener('click', () => {
      // Open a popular shopping site to get the user started
      chrome.tabs.create({ url: 'https://www.amazon.com' });
      // Close the welcome tab
      window.close();
    });
  }
});
