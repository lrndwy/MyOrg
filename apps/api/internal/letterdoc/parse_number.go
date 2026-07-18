package letterdoc

import (
	"bytes"
	"image"
	"image/png"
	"strings"

	"github.com/disintegration/imaging"
)

const letterHeaderCropPercent = 42

// ocrDocumentHeaderRegion OCRs the top portion of scan pages where nomor surat usually appears.
func ocrDocumentHeaderRegion(data []byte, fileName string) (string, error) {
	kind := detectIncomingKind(data, fileName)
	switch kind {
	case "pdf":
		pages, err := collectPDFPagesForOCR(data)
		if err != nil {
			return "", err
		}
		if len(pages) == 0 {
			return "", nil
		}
		cropped, err := cropLetterHeaderRegion(pages[0].data)
		if err != nil {
			return "", err
		}
		return ocrPageImages([]pdfPageImage{{data: cropped, fileName: "header.png"}})
	case "image":
		cropped, err := cropLetterHeaderRegion(data)
		if err != nil {
			return "", err
		}
		return ocrDocumentBytes(cropped, fileName)
	default:
		return "", nil
	}
}

func cropLetterHeaderRegion(imgData []byte) ([]byte, error) {
	img, err := imaging.Decode(bytes.NewReader(imgData))
	if err != nil {
		return imgData, nil
	}
	b := img.Bounds()
	w, h := b.Dx(), b.Dy()
	if h <= 0 || w <= 0 {
		return imgData, nil
	}

	topH := h * letterHeaderCropPercent / 100
	if topH < 120 {
		topH = h
	}
	if topH > h {
		topH = h
	}

	cropped := imaging.Crop(img, image.Rect(b.Min.X, b.Min.Y, b.Max.X, b.Min.Y+topH))
	var buf bytes.Buffer
	if err := png.Encode(&buf, cropped); err != nil {
		return imgData, nil
	}
	return buf.Bytes(), nil
}

func letterNumberSearchText(text string) string {
	compact := strings.ToUpper(strings.Join(strings.Fields(text), " "))
	if len(compact) > 1500 {
		return compact[:1500]
	}
	return compact
}
