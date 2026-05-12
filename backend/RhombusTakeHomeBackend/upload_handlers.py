import os
import uuid
from pathlib import Path

from django.conf import settings
from django.core.files.uploadedfile import UploadedFile
from django.core.files.uploadhandler import FileUploadHandler, StopUpload

ALLOWED_EXTENSIONS = {'.csv', '.xls', '.xlsx', '.xlsm', '.xlsb'}
ALLOWED_CONTENT_TYPES = {
    'text/csv',
    'application/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel.sheet.macroEnabled.12',
    'application/vnd.ms-excel.sheet.binary.macroEnabled.12',
}

CONTENT_TYPE_TO_EXT = {
    'text/csv': '.csv',
    'application/csv': '.csv',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.ms-excel.sheet.macroEnabled.12': '.xlsm',
    'application/vnd.ms-excel.sheet.binary.macroEnabled.12': '.xlsb',
}

UPLOAD_DIR = Path(settings.BASE_DIR) / 'uploads'


class StreamingFileUploadHandler(FileUploadHandler):
    chunk_size = 64 * 1024

    rejected = False
    reject_reason = ''
    dest = None
    dest_path = None
    file_id = None
    bytes_written = 0

    def new_file(self, *args, **kwargs):
        super().new_file(*args, **kwargs)
        ext = os.path.splitext(self.file_name or '')[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            ext = CONTENT_TYPE_TO_EXT.get(self.content_type, '')
        if ext not in ALLOWED_EXTENSIONS:
            self.rejected = True
            self.reject_reason = 'unsupported file type; expected CSV or Excel'
            raise StopUpload(connection_reset=False)

        UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        self.file_id = f'{uuid.uuid4().hex}{ext}'
        self.dest_path = UPLOAD_DIR / self.file_id
        self.dest = open(self.dest_path, 'wb')
        self.bytes_written = 0

    def receive_data_chunk(self, raw_data, start):
        self.dest.write(raw_data)
        self.bytes_written += len(raw_data)
        return None

    def file_complete(self, file_size):
        self.dest.close()
        f = UploadedFile(
            file=None,
            name=self.file_name,
            content_type=self.content_type,
            size=file_size if file_size is not None else self.bytes_written,
            charset=self.charset,
            content_type_extra=self.content_type_extra,
        )
        f.file_id = self.file_id
        return f

    def upload_complete(self):
        if self.dest is not None and not self.dest.closed:
            self.dest.close()
