# TOEFL ITP Vocab

Web tĩnh để học 500 từ trong *Barron's Essential Words for the TOEFL* (30 lesson): flashcard lặp lại ngắt quãng với gợi ý 3 bậc, quiz (ngữ cảnh / matching / đồng nghĩa / điền từ), thi thử bấm giờ, sổ lỗi sai, tra từ. Tiến độ lưu trong `localStorage`.

## Chạy
Mở `index.html` trực tiếp, hoặc `python3 -m http.server` rồi vào http://localhost:8000. Có thể bật GitHub Pages cho nhánh này.

## Dữ liệu
`data/words.js` được trích từ PDF sách bằng `tools/` (`pdftotext -layout` → `parse_book.py` → `solve_answers.py` + `manual_answers.py` → `build_data.py`). Sách không kèm answer key nên đáp án được suy ra từ cột `syn.`; các câu còn lại điền tay trong `manual_answers.py`, đã đối chiếu 100/100 với key Lesson 1–5.
Nội dung sách thuộc bản quyền tác giả/nhà xuất bản — chỉ dùng cá nhân, nên để repo ở chế độ private.
