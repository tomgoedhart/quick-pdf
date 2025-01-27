const footerTemplate = (data) => `
  <footer style="margin: 2cm auto 1cm; width: 100%; text-align: center; font-size: 10px; color: #000; -webkit-print-color-adjust: exact;">
    <style>
      *{
        font-family: Futura, sans-serif;
        margin: 0;
        padding: 0;
        -webkit-font-smoothing: antialiased;
      }
    
      #footer { 
        padding: 0 !important;
      }
      
      footer p { 
        font-size: 8px;
        font-style: italic;
        text-align: center;
        max-width: 60%;
        margin: 0 auto;
      }

      .pageNumber {
        position: absolute;
        bottom: 1cm;
        right: 1cm;
      }
    </style>
    <p>${data.footer.footer_header}</p>
    <p>${data.footer.footer_body}</p>
    <span class="pageNumber"></span>
  </footer>
`;

export default footerTemplate;
