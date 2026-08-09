// Shared small UI helpers used across pages.

const KCSE_SUBJECTS = [
  'Mathematics', 'English', 'Kiswahili', 'Kenya Sign Language',
  'Biology', 'Chemistry', 'Physics',
  'History', 'Geography', 'Christian Religious Education', 'Islamic Religious Education', 'Hindu Religious Education',
  'Home Science', 'Art and Design', 'Agriculture', 'Computer Studies',
  'French', 'German', 'Arabic', 'Music', 'Business Studies',
  'Building Construction', 'Power Mechanics', 'Metal Work', 'Woodwork', 'Electricity', 'Drawing and Design', 'Aviation Technology'
];

const KCSE_GRADES = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'E'];

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  });
  (Array.isArray(children) ? children : [children]).forEach(c => {
    if (c) node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return node;
}

function showError(node, message) {
  node.textContent = message;
  node.classList.add('visible');
}
function clearError(node) {
  node.textContent = '';
  node.classList.remove('visible');
}
