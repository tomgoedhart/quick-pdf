const date = new Date().toLocaleDateString();

const footerTemplate = `<footer style="margin: 2cm auto 0; width: 100%; text-align: center; font-size: 18px; background: #333; color: #fff; -webkit-print-color-adjust: exact;">
    <style>#header, #footer { padding: 0 !important; }</style>
    <p>QUICK ${date}</p>
  </footer>`;

export default footerTemplate;
