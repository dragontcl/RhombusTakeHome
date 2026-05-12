from django.urls import path

from . import views

urlpatterns = [
    path('upload/', views.upload, name='upload'),
    path('preview/<str:file_id>/', views.preview, name='preview'),
    path('generate-regex/', views.generate_regex, name='generate_regex'),
    path('transform/', views.transform, name='transform'),
    path('download/<str:file_id>/', views.download, name='download'),
]
