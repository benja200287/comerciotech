function el(q){return document.querySelector(q)}

function createBackHomeButton(){
  const header = el('.header');
  if (!header || el('.volver-inicio')) return;
  const button = document.createElement('a');
  button.href = '/';
  button.className = 'page-link volver-inicio';
  button.textContent = 'Volver al inicio';
  header.appendChild(button);
}

window.createBackHomeButton = createBackHomeButton;
