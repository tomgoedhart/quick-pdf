const printPDF = async (path, printer) => {
  // Prepare the request payload
  const payload = {
    s3_url: path,
    printer: printer || null,
  };

  console.log("Printing PDF:", payload);

  try {
    const response = await fetch(process.env.NODE_PRINTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to print PDF");
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error printing PDF:", error.message);
    throw error;
  }
};

export default printPDF;

// Usage examples:
// printPDF('/path/to/local/file.pdf')
// printPDF('/path/to/local/file.pdf', { printer: 'MyPrinter' })
// printPDF('s3://mybucket/path/to/file.pdf')
// printPDF('https://example.com/file.pdf', { printer: 'MyPrinter' })
