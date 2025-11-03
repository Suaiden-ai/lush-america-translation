import React, { useState, useRef, useEffect } from 'react';
import { Folder as FolderIcon, FileText, Plus, MoreVertical, ArrowLeft, Grid, List, Download, Eye, Edit2, Trash2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useFolders } from '../../hooks/useFolders';
import { useTranslatedDocuments } from '../../hooks/useDocuments';
import { useNavigate } from 'react-router-dom';
import { supabase, db } from '../../lib/supabase';
import { formatDateTime } from '../../utils/dateUtils';
import { Logger } from '../../lib/loggingHelpers';
import { ActionTypes } from '../../types/actionTypes';

export default function MyDocumentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedFile, setSelectedFile] = useState<any | null>(null);
  const [draggedFileId, setDraggedFileId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [dragOverRoot, setDragOverRoot] = useState<boolean>(false);
  const openFolderTimeout = useRef<NodeJS.Timeout | null>(null);
  const [dragOverBreadcrumb, setDragOverBreadcrumb] = useState<string | null>(null);
  const [movingFileId, setMovingFileId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isRenaming, setIsRenaming] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<any | null>(null);
  const [showRenameFolderModal, setShowRenameFolderModal] = useState(false);
  const [showDeleteFolderModal, setShowDeleteFolderModal] = useState(false);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  
  // Modal de visualização de documento
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'pdf' | 'image' | 'unknown'>('unknown');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewDocument, setPreviewDocument] = useState<any | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);

  const { folders, createFolder, updateFolder, deleteFolder, loading: foldersLoading } = useFolders(user?.id);
  const { documents, loading: docsLoading, refetch } = useTranslatedDocuments(user?.id);

  // DEBUG: Logs para identificar problemas (reduzidos para evitar spam)
  useEffect(() => {
    console.log('[MyDocumentsPage] DEBUG - Dados carregados:', {
      userId: user?.id,
      foldersCount: folders?.length || 0,
      documentsCount: documents?.length || 0,
      currentFolderId,
      foldersLoading,
      docsLoading,
      draggedFileId
    });
  }, [user?.id, folders?.length, documents?.length, currentFolderId, foldersLoading, docsLoading, draggedFileId]);

  // Cleanup touch drag on unmount
  useEffect(() => {
    return () => {
      // Cleanup removed - no more touch drag
    };
  }, []);

  // Close dropdown when clicking outside or changing folder
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openDropdownId && !(event.target as Element).closest('.dropdown-container')) {
        setOpenDropdownId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openDropdownId]);

  // Close dropdown when changing folder
  useEffect(() => {
    setOpenDropdownId(null);
  }, [currentFolderId]);

  // Filtrar pastas e arquivos da pasta atual
  const currentFolders = folders.filter(f => f.parent_id === currentFolderId);
  // Exibir apenas documentos traduzidos (da tabela translated_documents), pois somente esses podem ser visualizados/baixados
  const currentDocuments = documents.filter(d => d.folder_id === currentFolderId && d.source === 'translated_documents' && !!d.translated_file_url);
  const currentFolder = folders.find(f => f.id === currentFolderId);

  // Navegar para pasta anterior
  const handleGoBack = () => {
    if (!currentFolderId) return;
    const parent = folders.find(f => f.id === currentFolderId)?.parent_id || null;
    setCurrentFolderId(parent);
  };

  // Criar nova pasta
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    await createFolder({ name: newFolderName, parent_id: currentFolderId });
    setNewFolderName('');
    setShowNewFolder(false);
  };

  // Função para mover arquivo para pasta
  const handleMoveFileToFolder = async (fileId: string, folderId: string | null) => {
    setMovingFileId(fileId);
    try {
      // Primeiro, verificar se o arquivo existe
      const { data: existingFile, error: checkError } = await supabase
        .from('translated_documents')
        .select('id, folder_id, filename')
        .eq('id', fileId)
        .single();
      
      if (checkError) {
        throw checkError;
      }
      
      // Atualizar folder_id do arquivo
      const { data, error } = await supabase
        .from('translated_documents')
        .update({ folder_id: folderId })
        .eq('id', fileId)
        .select();
      
      if (error) throw error;
      await refetch();
      setTimeout(() => setMovingFileId(null), 800); // animação mais suave
    } catch (err) {
      console.error('[DRAG-DROP] Erro ao mover arquivo:', err);
      alert('Erro ao mover arquivo: ' + (err as any).message);
      setMovingFileId(null);
    }
  };

  // Função para mover pasta para outra pasta
  const handleMoveFolderToFolder = async (folderId: string, newParentId: string | null) => {
    try {
      await updateFolder(folderId, { parent_id: newParentId });
      await refetch();
    } catch (err) {
      alert('Erro ao mover pasta: ' + (err as any).message);
    }
  };

  // Função para obter todas as pastas disponíveis para mover (excluindo a pasta atual e suas subpastas)
  const getAvailableFoldersForMove = () => {
    return folders.filter(f => f.id !== currentFolderId);
  };

  // Funções para touch drag and drop
  const handleTouchStart = (e: React.TouchEvent, item: any, type: 'file' | 'folder') => {
    // Removed touch drag logic
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    // Removed touch drag logic
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    // Removed touch drag logic
  };

  const handleTouchCancel = () => {
    // Removed touch drag logic
  };

  // Função para montar o caminho (breadcrumb) até a pasta atual
  function getBreadcrumbPath() {
    const path: { id: string | null, name: string }[] = [];
    let folder = folders.find(f => f.id === currentFolderId) || null;
    while (folder) {
      path.unshift({ id: folder.id, name: folder.name });
      const parentFolder = folders.find(f => f.id === folder?.parent_id) || null;
      folder = parentFolder;
    }
    path.unshift({ id: null, name: 'My Documents' });
    return path;
  }
  const breadcrumbPath = getBreadcrumbPath();

  // Função para colapsar breadcrumb se for muito longo
  function getCollapsedBreadcrumb(path: { id: string | null, name: string }[]) {
    if (path.length <= 4) return path.map((c, i) => ({ ...c, isEllipsis: false }));
    // Exibe: primeiro, ellipsis, penúltimo-2, penúltimo-1, último
    return [
      { ...path[0], isEllipsis: false },
      { id: 'ellipsis', name: '...', isEllipsis: true, tooltip: path.slice(1, -3).map(p => p.name).join(' / ') },
      ...path.slice(-3).map(c => ({ ...c, isEllipsis: false }))
    ];
  }
  const collapsedBreadcrumb = getCollapsedBreadcrumb(breadcrumbPath);


  // Função para renomear arquivo
  const handleRenameFile = async () => {
    if (!newFileName.trim() || newFileName.trim() === selectedFile?.filename) {
      setIsRenaming(false);
      setNewFileName('');
      return;
    }

    try {
      const { error } = await supabase
        .from('translated_documents')
        .update({ filename: newFileName.trim() })
        .eq('id', selectedFile?.id);

      if (error) throw error;

      // Atualizar o arquivo selecionado localmente
      if (selectedFile) {
        setSelectedFile({ ...selectedFile, filename: newFileName.trim() });
      }

      // Recarregar a lista de documentos
      await refetch();

      setIsRenaming(false);
      setNewFileName('');
    } catch (err) {
      alert('Error renaming file: ' + (err as any).message);
    }
  };

  // Função para cancelar rename
  const handleCancelRename = () => {
    setIsRenaming(false);
    setNewFileName('');
  };

  // Função para deletar arquivo (delete visual)
  const handleDeleteFile = async () => {
    if (!selectedFile) return;

    try {
      const { error } = await supabase
        .from('translated_documents')
        .update({ is_deleted: true })
        .eq('id', selectedFile.id);

      if (error) throw error;

      // Fechar modal e recarregar lista
      setSelectedFile(null);
      await refetch();
    } catch (err) {
      alert('Error deleting file: ' + (err as any).message);
    }
  };

  // Função para abrir modal de renomear pasta
  const handleOpenRenameFolder = (folder: any) => {
    setSelectedFolder(folder);
    setEditingFolderName(folder.name);
    setShowRenameFolderModal(true);
  };

  // Função para renomear pasta
  const handleRenameFolder = async () => {
    if (!selectedFolder || !editingFolderName.trim() || editingFolderName.trim() === selectedFolder.name) {
      setShowRenameFolderModal(false);
      setSelectedFolder(null);
      setEditingFolderName('');
      return;
    }

    try {
      await updateFolder(selectedFolder.id, { name: editingFolderName.trim() });
      
      // Fechar modal e limpar estados
      setShowRenameFolderModal(false);
      setSelectedFolder(null);
      setEditingFolderName('');
    } catch (err) {
      alert('Error renaming folder: ' + (err as any).message);
    }
  };

  // Função para abrir modal de deletar pasta
  const handleOpenDeleteFolder = (folder: any) => {
    setSelectedFolder(folder);
    setShowDeleteFolderModal(true);
  };

  // Função para deletar pasta
  const handleDeleteFolder = async () => {
    if (!selectedFolder) return;

    try {
      await deleteFolder(selectedFolder.id);
      
      // Fechar modal e limpar estados
      setShowDeleteFolderModal(false);
      setSelectedFolder(null);
    } catch (err) {
      alert('Error deleting folder: ' + (err as any).message);
    }
  };

  return (
    <div className="max-w-5xl mx-auto mt-4 sm:mt-10 bg-white rounded-xl shadow p-4 sm:p-8 min-h-[70vh]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-4">
        <div className="flex items-center gap-2 min-w-0">
          {currentFolderId && (
            <button onClick={handleGoBack} className="p-2 rounded hover:bg-gray-100" title="Go back">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <nav className="flex items-center gap-1 text-base sm:text-lg font-medium min-w-0 overflow-x-auto whitespace-nowrap">
            {collapsedBreadcrumb.map((crumb, idx) => (
              <React.Fragment key={crumb.id ?? `crumb-${idx}`}>
                {crumb.isEllipsis ? (
                  <div
                    className="px-1 sm:px-2 py-1 rounded text-gray-500 cursor-default"
                    title={crumb.tooltip}
                    style={{ display: 'inline-block', maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis' }}
                  >
                    ...
                  </div>
                ) : (
                  <div
                    className={`px-1 sm:px-2 py-1 rounded transition-colors duration-150 ${dragOverBreadcrumb === (crumb.id ?? 'root') ? 'bg-tfe-blue-100 text-tfe-blue-800 ring-2 ring-tfe-blue-400' : 'text-gray-900'} ${idx === collapsedBreadcrumb.length - 1 ? 'font-bold' : 'cursor-pointer hover:bg-gray-100'}`}
                    style={{ display: 'inline-block', maxWidth: collapsedBreadcrumb.length > 4 ? 100 : 'none', overflow: collapsedBreadcrumb.length > 4 ? 'hidden' : 'visible', textOverflow: collapsedBreadcrumb.length > 4 ? 'ellipsis' : 'clip' }}
                    onClick={() => {
                      if (crumb.id !== currentFolderId) setCurrentFolderId(crumb.id);
                    }}
                    onDragOver={e => {
                      if (draggedFileId) {
                        e.preventDefault();
                        setDragOverBreadcrumb(crumb.id ?? 'root');
                      }
                    }}
                    onDragLeave={e => {
                      if (draggedFileId) setDragOverBreadcrumb(null);
                    }}
                    onDrop={e => {
                      if (draggedFileId) {
                        e.preventDefault();
                        setDragOverBreadcrumb(null);
                        handleMoveFileToFolder(draggedFileId, crumb.id);
                        setDraggedFileId(null);
                      }
                    }}
                    title={dragOverBreadcrumb === (crumb.id ?? 'root') && draggedFileId ? 'Move here' : crumb.name}
                  >
                    {crumb.name}
                  </div>
                )}
                {idx < collapsedBreadcrumb.length - 1 && <span className="mx-1 text-gray-400" aria-label="separator">&gt;</span>}
              </React.Fragment>
            ))}
          </nav>
        </div>
        <div className="flex gap-2">
          <button
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm sm:text-base"
            onClick={() => setShowNewFolder(true)}
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" /> 
            <span className="hidden sm:inline">New Folder</span>
            <span className="sm:hidden">Folder</span>
          </button>
        </div>
      </div>

      {/* Instructions and Features */}
      <div className="bg-tfe-blue-50 border border-tfe-blue-200 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
        <h3 className="text-xs sm:text-sm font-semibold text-tfe-blue-950 mb-2">📁 My Documents - Features & Instructions</h3>
        <div className="text-xs sm:text-sm text-tfe-blue-800 space-y-1">
          <p><strong>• Organize:</strong> Create folders to organize your translated documents</p>
          <p><strong>• Drag & Drop:</strong> Drag files between folders or to the root level</p>
          <p><strong>• Manage:</strong> Hover over folders to see options (rename/delete)</p>
          <p><strong>• View:</strong> Click on documents to view details and download</p>
          <p><strong>• Navigate:</strong> Use breadcrumbs to move between folders</p>
          <p><strong>• Search:</strong> Use the search bar to find specific documents</p>
        </div>
      </div>

      {/* View Mode Toggle */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            className={`flex items-center gap-1 px-2 sm:px-3 py-1 rounded-md text-xs sm:text-sm font-medium transition-colors ${
              viewMode === 'grid' 
                ? 'bg-white text-tfe-blue-600 shadow-sm' 
                : 'text-gray-600 hover:text-gray-800'
            }`}
            onClick={() => setViewMode('grid')}
          >
            <Grid className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Grid</span>
          </button>
          <button
            className={`flex items-center gap-1 px-2 sm:px-3 py-1 rounded-md text-xs sm:text-sm font-medium transition-colors ${
              viewMode === 'list' 
                ? 'bg-white text-tfe-blue-600 shadow-sm' 
                : 'text-gray-600 hover:text-gray-800'
            }`}
            onClick={() => setViewMode('list')}
          >
            <List className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">List</span>
          </button>
        </div>
      </div>

      {showNewFolder && (
        <form onSubmit={handleCreateFolder} className="mb-4 sm:mb-6 flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          <input
            type="text"
            className="border px-3 py-2 rounded-md focus:ring-2 focus:ring-tfe-blue-500 focus:border-tfe-blue-500 flex-1"
            placeholder="Folder name"
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            autoFocus
          />
          <div className="flex gap-2 w-full sm:w-auto">
            <button type="submit" className="flex-1 sm:flex-none bg-tfe-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-tfe-blue-700 transition-colors text-sm">Create</button>
            <button type="button" className="flex-1 sm:flex-none text-gray-500 px-3 py-2 text-sm" onClick={() => setShowNewFolder(false)}>Cancel</button>
          </div>
        </form>
      )}

      {/* Grid View */}
      {viewMode === 'grid' && (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6"
        onDragOver={e => {
          e.preventDefault();
          if (!dragOverFolderId && draggedFileId) {
            if (!dragOverRoot) setDragOverRoot(true);
          }
        }}
        onDragLeave={e => {
          if (!dragOverFolderId && draggedFileId) {
            setDragOverRoot(false);
          }
        }}
        onDrop={e => {
          e.preventDefault();
          if (!dragOverFolderId && draggedFileId) {
            setDragOverRoot(false);
            handleMoveFileToFolder(draggedFileId, null);
            setDraggedFileId(null);
          }
        }}
        style={{ minHeight: 120, background: dragOverRoot && draggedFileId ? '#e0f2fe' : '#fff', transition: 'background 0.2s' }}
      >
        {foldersLoading && <span>Loading folders...</span>}
        {currentFolders.map((item) => (
          <div
            key={item.id}
            className={`group relative bg-gray-50 rounded-xl p-3 sm:p-4 flex flex-col items-center justify-center shadow hover:shadow-md transition cursor-pointer border border-gray-100 hover:border-tfe-blue-400 ${dragOverFolderId === item.id ? 'ring-2 ring-tfe-blue-400' : ''}`}
            onClick={() => setCurrentFolderId(item.id)}
            title={`Open folder ${item.name}`}
                          onDragOver={e => {
                e.preventDefault();
                setDragOverFolderId(item.id);
              }}
            onDragLeave={() => {
              setDragOverFolderId(null);
              if (openFolderTimeout.current) clearTimeout(openFolderTimeout.current);
            }}
            onDrop={e => {
              e.preventDefault();
              console.log('[DRAG-DROP] Drop na pasta:', item.id, 'arquivo:', draggedFileId);
              setDragOverFolderId(null);
              if (openFolderTimeout.current) clearTimeout(openFolderTimeout.current);
              if (draggedFileId) {
                console.log('[DRAG-DROP] Executando movimentação...');
                handleMoveFileToFolder(draggedFileId, item.id);
                setDraggedFileId(null);
              } else {
                console.log('[DRAG-DROP] Nenhum arquivo sendo arrastado');
              }
            }}
          >
            <FolderIcon className="w-8 h-8 sm:w-10 sm:h-10 text-yellow-500 mb-2 group-hover:scale-110 transition-transform" />
            <span className="text-gray-800 font-medium text-center truncate w-full text-sm sm:text-base">{item.name}</span>
            <div className="absolute top-2 right-2">
              <div className="relative dropdown-container">
                <button 
                  className="p-1 text-gray-400 hover:text-gray-600 rounded transition-opacity opacity-0 group-hover:opacity-100"
                  aria-label="More options"
                  title="More options"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenDropdownId(openDropdownId === item.id ? null : item.id);
                  }}
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
                {openDropdownId === item.id && (
                  <div className="absolute right-0 top-6 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 min-w-[120px]">

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenDropdownId(null);
                        handleOpenRenameFolder(item);
                      }}
                      className="w-full px-3 py-1 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Rename</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenDropdownId(null);
                        handleOpenDeleteFolder(item);
                      }}
                      className="w-full px-3 py-1 text-left text-sm text-tfe-red-600 hover:bg-tfe-red-50 flex items-center space-x-2"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Delete</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {docsLoading && (
          <div className="col-span-1 sm:col-span-2 md:col-span-4 flex gap-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="bg-gray-100 rounded-xl p-4 flex-1 min-h-[90px] animate-pulse" />
            ))}
          </div>
        )}
        {currentDocuments.map((item) => (
          <div
            key={item.id}
            className={`group relative rounded-xl p-3 sm:p-4 flex flex-col items-center justify-center shadow cursor-pointer border transition-all duration-500 ${
              movingFileId === item.id 
                ? 'bg-green-50 border-green-200 shadow-lg scale-105 transform' 
                : 'bg-gray-50 border-gray-100 hover:shadow-md hover:border-tfe-blue-400'
            }`}
            onClick={() => setSelectedFile(item)}
            title={`Open file ${item.filename}`}
            draggable={true}
                          onDragStart={() => {
                setDraggedFileId(item.id);
              }}
              onDragEnd={() => {
                setDraggedFileId(null);
              }}
            style={{ 
              opacity: movingFileId === item.id ? 0.8 : 1, 
              transition: 'all 0.5s ease-in-out',
              transform: movingFileId === item.id ? 'scale(1.05) translateY(-2px)' : 'scale(1) translateY(0)'
            }}
          >
            <FileText className={`w-8 h-8 sm:w-10 sm:h-10 mb-2 transition-all duration-500 ${
              movingFileId === item.id 
                ? 'text-green-500 scale-110' 
                : 'text-tfe-blue-500 group-hover:scale-110'
            }`} />
            <span className={`font-medium text-center truncate w-full text-sm sm:text-base transition-colors duration-500 ${
              movingFileId === item.id 
                ? 'text-green-700' 
                : 'text-gray-800'
            }`}>
              {item.original_filename || item.filename}
            </span>
            {item.original_filename && item.original_filename !== item.filename && (
              <span className="text-xs text-gray-500 text-center truncate w-full mt-1">
                {item.filename}
              </span>
            )}
          </div>
        ))}
      </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="space-y-2"
          onDragOver={e => {
            e.preventDefault();
            if (!dragOverFolderId && draggedFileId) {
              if (!dragOverRoot) setDragOverRoot(true);
            }
          }}
          onDragLeave={e => {
            if (!dragOverFolderId && draggedFileId) {
              setDragOverRoot(false);
            }
          }}
          onDrop={e => {
            e.preventDefault();
            if (!dragOverFolderId && draggedFileId) {
              setDragOverRoot(false);
              handleMoveFileToFolder(draggedFileId, null);
              setDraggedFileId(null);
            }
          }}
          style={{ background: dragOverRoot && draggedFileId ? '#e0f2fe' : 'transparent', transition: 'background 0.2s', borderRadius: '8px', padding: dragOverRoot && draggedFileId ? '16px' : '0' }}
        >
          {/* Folders */}
          {currentFolders.map((item) => (
            <div
              key={item.id}
              className={`group relative bg-gray-50 rounded-lg p-3 sm:p-4 flex items-center gap-3 sm:gap-4 shadow hover:shadow-md transition cursor-pointer border border-gray-100 hover:border-tfe-blue-400 ${dragOverFolderId === item.id ? 'ring-2 ring-tfe-blue-400' : ''}`}
              onClick={() => setCurrentFolderId(item.id)}
              title={`Open folder ${item.name}`}
              onDragOver={e => {
                e.preventDefault();
                console.log('[DRAG-DROP] Drag over pasta:', item.id);
                setDragOverFolderId(item.id);
                // Inicia um timer para abrir a pasta após 400ms
                if (openFolderTimeout.current) clearTimeout(openFolderTimeout.current);
                openFolderTimeout.current = setTimeout(() => {
                  setCurrentFolderId(item.id);
                }, 400);
              }}
              onDragLeave={() => {
                setDragOverFolderId(null);
                if (openFolderTimeout.current) clearTimeout(openFolderTimeout.current);
              }}
              onDrop={e => {
                e.preventDefault();
                setDragOverFolderId(null);
                if (openFolderTimeout.current) clearTimeout(openFolderTimeout.current);
                if (draggedFileId) {
                  handleMoveFileToFolder(draggedFileId, item.id);
                  setDraggedFileId(null);
                }
              }}
            >
              <FolderIcon className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-gray-800 font-medium truncate block text-sm sm:text-base">{item.name}</span>
                <span className="text-xs sm:text-sm text-gray-500">Folder</span>
              </div>
              <div className="flex items-center gap-1 sm:gap-2">
                <div className="relative dropdown-container">
                  <button 
                    className="text-gray-400 hover:text-gray-700 p-1 rounded-full" 
                    title="More options"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenDropdownId(openDropdownId === item.id ? null : item.id);
                    }}
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  {openDropdownId === item.id && (
                    <div className="absolute right-0 top-6 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 min-w-[120px]">

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenDropdownId(null);
                          handleOpenRenameFolder(item);
                        }}
                        className="w-full px-3 py-1 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Rename</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenDropdownId(null);
                          handleOpenDeleteFolder(item);
                        }}
                        className="w-full px-3 py-1 text-left text-sm text-tfe-red-600 hover:bg-tfe-red-50 flex items-center space-x-2"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Delete</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Documents */}
          {currentDocuments.map((item) => (
            <div
              key={item.id}
              className={`group relative rounded-lg p-3 sm:p-4 flex items-center gap-3 sm:gap-4 shadow cursor-pointer border transition-all duration-500 ${
                movingFileId === item.id 
                  ? 'bg-green-50 border-green-200 shadow-lg' 
                  : 'bg-gray-50 border-gray-100 hover:shadow-md hover:border-tfe-blue-400'
              }`}
              onClick={() => setSelectedFile(item)}
              title={`Open file ${item.filename}`}
              draggable={true}
                              onDragStart={() => {
                  setDraggedFileId(item.id);
                }}
                onDragEnd={() => {
                  setDraggedFileId(null);
                }}
              style={{ 
                opacity: movingFileId === item.id ? 0.9 : 1, 
                transition: 'all 0.5s ease-in-out',
                transform: movingFileId === item.id ? 'translateX(4px)' : 'translateX(0)'
              }}
            >
              <FileText className={`w-6 h-6 sm:w-8 sm:h-8 flex-shrink-0 transition-all duration-500 ${
                movingFileId === item.id 
                  ? 'text-green-500 scale-110' 
                  : 'text-tfe-blue-500'
              }`} />
              <div className="flex-1 min-w-0">
                <span className={`font-medium truncate block text-sm sm:text-base transition-colors duration-500 ${
                  movingFileId === item.id 
                    ? 'text-green-700' 
                    : 'text-gray-800'
                }`}>
                  {item.original_filename || item.filename}
                </span>
                {item.original_filename && item.original_filename !== item.filename && (
                  <span className="text-xs text-gray-500 truncate block">
                    {item.filename}
                  </span>
                )}
                <span className="text-xs sm:text-sm text-gray-500">
                  {item.created_at ? formatDateTime(item.created_at) : 'Unknown date'}
                </span>
              </div>
              <div className="flex items-center gap-1 sm:gap-2">
                <button 
                  className="text-gray-400 hover:text-tfe-blue-600 p-2 rounded-full transition-colors" 
                  title="View document"
                  onClick={async (e) => {
                    e.stopPropagation();
                    
                    // Log de visualização do documento
                    try {
                      await Logger.log(
                        ActionTypes.DOCUMENT.VIEWED,
                        `Document viewed: ${item.original_filename || item.filename}`,
                        {
                          entityType: 'document',
                          entityId: item.id,
                          metadata: {
                            document_id: item.id,
                            filename: item.original_filename || item.filename,
                            file_url: item.translated_file_url,
                            file_type: (item.original_filename || item.filename)?.split('.').pop()?.toLowerCase(),
                            user_id: user?.id,
                            timestamp: new Date().toISOString(),
                            view_type: 'new_tab'
                          },
                          affectedUserId: user?.id,
                          performerType: 'user'
                        }
                      );
                    } catch (logError) {
                      console.error('Error logging document view:', logError);
                    }
                    
                    // Abrir no modal usando setSelectedFile (não usar window.open)
                    setSelectedFile(item);
                  }}
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button 
                  className="text-gray-400 hover:text-green-600 p-2 rounded-full transition-colors" 
                  title="Download document"
                  onClick={async (e) => {
                    e.stopPropagation();
                    
                    // Log de download do documento
                    try {
                      await Logger.log(
                        ActionTypes.DOCUMENT.DOWNLOADED,
                        `Document downloaded: ${item.original_filename || item.filename}`,
                        {
                          entityType: 'document',
                          entityId: item.id,
                          metadata: {
                            document_id: item.id,
                            filename: item.original_filename || item.filename,
                            file_url: item.translated_file_url,
                            file_type: (item.original_filename || item.filename)?.split('.').pop()?.toLowerCase(),
                            user_id: user?.id,
                            timestamp: new Date().toISOString(),
                            download_type: 'my_documents_download'
                          },
                          affectedUserId: user?.id,
                          performerType: 'user'
                        }
                      );
                    } catch (logError) {
                      console.error('Error logging document download:', logError);
                    }
                    
                    try {
                      // Extrair filePath e bucket da URL
                      const { extractFilePathFromUrl } = await import('../../utils/fileUtils');
                      const pathInfo = extractFilePathFromUrl(item.translated_file_url);
                      
                      if (!pathInfo) {
                        // Se não conseguir extrair, tentar download direto da URL (para S3 externo)
                        try {
                          const response = await fetch(item.translated_file_url);
                          if (response.ok) {
                            const blob = await response.blob();
                            const url = window.URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = item.filename;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            window.URL.revokeObjectURL(url);
                            return;
                          }
                        } catch (error) {
                          alert('Não foi possível acessar o arquivo. Verifique sua conexão.');
                          return;
                        }
                      }
                      
                      // Usar download autenticado direto
                      const success = await db.downloadFileAndTrigger(pathInfo.filePath, item.filename, pathInfo.bucket);
                      
                      if (!success) {
                        alert('Não foi possível baixar o arquivo. Verifique se você está autenticado.');
                      }
                    } catch (error) {
                      console.error('Error downloading file:', error);
                      alert(`Erro ao baixar arquivo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
                    }
                  }}
                >
                  <Download className="w-4 h-4" />
                </button>
                <button className="text-gray-400 hover:text-gray-700 p-2 rounded-full" title="More options">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          {/* Loading state for list view */}
          {docsLoading && (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-gray-100 rounded-lg p-3 sm:p-4 flex items-center gap-3 sm:gap-4 animate-pulse">
                  <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gray-200 rounded flex-shrink-0" />
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!foldersLoading && !docsLoading && currentFolders.length === 0 && currentDocuments.length === 0 && (
            <div className="text-center py-8 sm:py-12 text-gray-500">
              <FileText className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-base sm:text-lg font-medium">No documents or folders</p>
              <p className="text-xs sm:text-sm">Your translated documents will appear here</p>
            </div>
          )}
        </div>
      )}

      {/* Preview/Details Modal */}
      {selectedFile && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-8 w-full max-w-md sm:min-w-[400px] relative animate-fade-in max-h-[90vh] overflow-y-auto">
            <button
              className="absolute top-2 right-2 sm:top-4 sm:right-4 text-gray-400 hover:text-gray-600 text-xl font-bold"
              onClick={() => setSelectedFile(null)}
              aria-label="Close modal"
            >
              ×
            </button>
            <h3 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6 text-gray-900">File Details</h3>
            <div className="space-y-3 mb-4 sm:mb-6">
              <div>
                <span className="font-medium text-gray-700 text-sm sm:text-base">Name:</span> 
                {isRenaming ? (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mt-1">
                    <input
                      type="text"
                      value={newFileName}
                      onChange={(e) => setNewFileName(e.target.value)}
                      className="flex-1 border border-gray-300 rounded-md px-3 py-1 focus:ring-2 focus:ring-tfe-blue-500 focus:border-tfe-blue-500 text-sm"
                      placeholder="Enter new file name"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleRenameFile();
                        } else if (e.key === 'Escape') {
                          handleCancelRename();
                        }
                      }}
                    />
                    <div className="flex gap-2 w-full sm:w-auto">
                      <button
                        onClick={handleRenameFile}
                        className="flex-1 sm:flex-none px-3 py-1 bg-tfe-blue-600 text-white rounded-md text-sm hover:bg-tfe-blue-700 transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancelRename}
                        className="flex-1 sm:flex-none px-3 py-1 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="ml-2">
                    <span className="text-gray-900 text-sm sm:text-base">{selectedFile.original_filename || selectedFile.filename}</span>
                    {selectedFile.original_filename && selectedFile.original_filename !== selectedFile.filename && (
                      <div className="text-xs text-gray-500 mt-1">
                        System name: {selectedFile.filename}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div>
                <span className="font-medium text-gray-700 text-sm sm:text-base">Type:</span> 
                <span className="ml-2 text-gray-900 text-sm sm:text-base">
                  {selectedFile.filename?.split('.').pop()?.toUpperCase() || 'Unknown'}
                </span>
              </div>
              <div>
                <span className="font-medium text-gray-700 text-sm sm:text-base">Created:</span> 
                <span className="ml-2 text-gray-900 text-sm sm:text-base">
                  {selectedFile.created_at ? formatDateTime(selectedFile.created_at) : 'Unknown date'}
                </span>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button 
                className="flex-1 px-4 py-2 bg-tfe-blue-600 text-white rounded-lg font-medium hover:bg-tfe-blue-700 transition-colors flex items-center justify-center gap-2 text-sm"
                onClick={async () => {
                  // Log de visualização do documento
                  try {
                    await Logger.log(
                      ActionTypes.DOCUMENT.VIEWED,
                      `Document viewed: ${selectedFile.original_filename || selectedFile.filename}`,
                      {
                        entityType: 'document',
                        entityId: selectedFile.id,
                        metadata: {
                          document_id: selectedFile.id,
                          filename: selectedFile.original_filename || selectedFile.filename,
                          file_url: selectedFile.translated_file_url,
                          file_type: (selectedFile.original_filename || selectedFile.filename)?.split('.').pop()?.toLowerCase(),
                          user_id: user?.id,
                          timestamp: new Date().toISOString(),
                          view_type: 'modal_view'
                        },
                        affectedUserId: user?.id,
                        performerType: 'user'
                      }
                    );
                  } catch (logError) {
                    console.error('Error logging document view:', logError);
                  }
                  
                  // Abrir no modal usando blob URL (não expõe URL original)
                  try {
                    setPreviewLoading(true);
                    setPreviewError(null);
                    setPreviewDocument(selectedFile);
                    
                    const { db } = await import('../../lib/supabase');
                    const { extractFilePathFromUrl } = await import('../../utils/fileUtils');
                    const pathInfo = extractFilePathFromUrl(selectedFile.translated_file_url);
                    
                    if (!pathInfo) {
                      throw new Error('Não foi possível acessar o arquivo. URL inválida.');
                    }
                    
                    // Fazer download autenticado do arquivo
                    const blob = await db.downloadFile(pathInfo.filePath, pathInfo.bucket);
                    
                    if (!blob) {
                      throw new Error('Não foi possível baixar o arquivo. Verifique se você está autenticado.');
                    }
                    
                    // Criar blob URL (URL local, não expõe URL original)
                    const blobUrl = window.URL.createObjectURL(blob);
                    
                    // Detectar tipo do arquivo
                    const filename = selectedFile.original_filename || selectedFile.filename;
                    const isImage = filename.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i);
                    const fileType = isImage ? 'image' : filename.toLowerCase().endsWith('.pdf') ? 'pdf' : 'unknown';
                    
                    setPreviewBlobUrl(blobUrl);
                    setPreviewUrl(blobUrl);
                    setPreviewType(fileType);
                    setPreviewOpen(true);
                  } catch (error) {
                    console.error('Erro ao abrir arquivo:', error);
                    setPreviewError(error instanceof Error ? error.message : 'Erro desconhecido');
                    setPreviewOpen(true);
                  } finally {
                    setPreviewLoading(false);
                  }
                }}
              >
                <Eye className="w-4 h-4" />
                View
              </button>
              <button 
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2 text-sm"
                onClick={async () => {
                  // Log de download do documento
                  try {
                    await Logger.log(
                      ActionTypes.DOCUMENT.DOWNLOADED,
                      `Document downloaded: ${selectedFile.original_filename || selectedFile.filename}`,
                      {
                        entityType: 'document',
                        entityId: selectedFile.id,
                        metadata: {
                          document_id: selectedFile.id,
                          filename: selectedFile.original_filename || selectedFile.filename,
                          file_url: selectedFile.translated_file_url,
                          file_type: (selectedFile.original_filename || selectedFile.filename)?.split('.').pop()?.toLowerCase(),
                          user_id: user?.id,
                          timestamp: new Date().toISOString(),
                          download_type: 'modal_download'
                        },
                        affectedUserId: user?.id,
                        performerType: 'user'
                      }
                    );
                  } catch (logError) {
                    console.error('Error logging document download:', logError);
                  }
                  
                  try {
                    // Extrair filePath e bucket da URL
                    const { extractFilePathFromUrl } = await import('../../utils/fileUtils');
                    const pathInfo = extractFilePathFromUrl(selectedFile.translated_file_url);
                    
                    if (!pathInfo) {
                      // Se não conseguir extrair, tentar download direto da URL (para S3 externo)
                      try {
                        const response = await fetch(selectedFile.translated_file_url);
                        if (response.ok) {
                          const blob = await response.blob();
                          const url = window.URL.createObjectURL(blob);
                          const link = document.createElement('a');
                          link.href = url;
                          link.download = selectedFile.filename;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          window.URL.revokeObjectURL(url);
                          return;
                        }
                      } catch (error) {
                        alert('Não foi possível acessar o arquivo. Verifique sua conexão.');
                        return;
                      }
                    }
                    
                    // Usar download autenticado direto
                    const success = await db.downloadFileAndTrigger(pathInfo.filePath, selectedFile.filename, pathInfo.bucket);
                    
                    if (!success) {
                      alert('Não foi possível baixar o arquivo. Verifique se você está autenticado.');
                    }
                  } catch (error) {
                    console.error('Error downloading file:', error);
                    alert(`Erro ao baixar arquivo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
                  }
                }}
              >
                <Download className="w-4 h-4" />
                Download
              </button>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-3">
              <button 
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors text-sm"
                onClick={() => {
                  setIsRenaming(true);
                  setNewFileName(selectedFile.filename);
                }}
                disabled={isRenaming}
              >
                Rename
              </button>
              <button 
                className="flex-1 px-4 py-2 bg-tfe-red-100 text-tfe-red-600 rounded-lg font-medium hover:bg-tfe-red-200 transition-colors text-sm"
                onClick={() => setShowDeleteConfirm(true)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedFile && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 w-full max-w-md sm:min-w-[400px] relative animate-fade-in">
            <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-gray-900">Confirm Delete</h3>
            <p className="text-gray-700 mb-4 sm:mb-6 text-sm sm:text-base">
              Are you sure you want to delete <strong>"{selectedFile.filename}"</strong>? 
              This action will remove the file from your documents list, but the file will remain in our system.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button 
                className="flex-1 px-4 py-2 bg-tfe-red-600 text-white rounded-lg font-medium hover:bg-tfe-red-700 transition-colors text-sm"
                onClick={() => {
                  handleDeleteFile();
                  setShowDeleteConfirm(false);
                }}
              >
                Delete
              </button>
              <button 
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors text-sm"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Folder Modal */}
      {showRenameFolderModal && selectedFolder && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 w-full max-w-md sm:min-w-[400px] relative animate-fade-in">
            <button
              className="absolute top-2 right-2 sm:top-4 sm:right-4 text-gray-400 hover:text-gray-600 text-xl font-bold"
              onClick={() => {
                setShowRenameFolderModal(false);
                setSelectedFolder(null);
                setEditingFolderName('');
              }}
              aria-label="Close modal"
            >
              ×
            </button>
            <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-gray-900">Rename Folder</h3>
            <div className="mb-4 sm:mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Folder Name
              </label>
              <input
                type="text"
                value={editingFolderName}
                onChange={(e) => setEditingFolderName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-tfe-blue-500 focus:border-tfe-blue-500 text-sm"
                placeholder="Enter new folder name"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleRenameFolder();
                  } else if (e.key === 'Escape') {
                    setShowRenameFolderModal(false);
                    setSelectedFolder(null);
                    setEditingFolderName('');
                  }
                }}
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                onClick={handleRenameFolder}
                className="flex-1 px-4 py-2 bg-tfe-blue-600 text-white rounded-lg font-medium hover:bg-tfe-blue-700 transition-colors text-sm"
              >
                Rename
              </button>
              <button
                onClick={() => {
                  setShowRenameFolderModal(false);
                  setSelectedFolder(null);
                  setEditingFolderName('');
                }}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Folder Modal */}
      {showDeleteFolderModal && selectedFolder && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 w-full max-w-md sm:min-w-[400px] relative animate-fade-in">
            <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-gray-900">Confirm Delete</h3>
            <p className="text-gray-700 mb-4 sm:mb-6 text-sm sm:text-base">
              Are you sure you want to delete the folder <strong>"{selectedFolder.name}"</strong>? 
              This action cannot be undone and will remove the folder and all its contents.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                onClick={() => {
                  handleDeleteFolder();
                  setShowDeleteFolderModal(false);
                  setSelectedFolder(null);
                }}
                className="flex-1 px-4 py-2 bg-tfe-red-600 text-white rounded-lg font-medium hover:bg-tfe-red-700 transition-colors text-sm"
              >
                Delete
              </button>
              <button
                onClick={() => {
                  setShowDeleteFolderModal(false);
                  setSelectedFolder(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move Modal - Removed for desktop focus */}

      {/* Touch Drag Indicator */}
      {/* Removed touch drag indicator */}

      {/* Modal de Visualização de Documento */}
      {previewOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[10000]" style={{ touchAction: 'none' }}>
          <div className="absolute inset-0 bg-white flex flex-col">
            <div className="flex items-center justify-between px-2 sm:px-4 py-2 sm:py-3 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-1">
                <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-tfe-blue-600 flex-shrink-0" />
                <span className="font-semibold text-gray-900 text-xs sm:text-sm truncate">{previewDocument?.original_filename || previewDocument?.filename || 'Document preview'}</span>
              </div>
              <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                <button
                  className="px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm bg-white border border-gray-300 rounded hover:bg-gray-50"
                  disabled={previewLoading || !previewUrl}
                  onClick={async () => {
                    if (!previewDocument) return;
                    try {
                      const { extractFilePathFromUrl } = await import('../../utils/fileUtils');
                      const pathInfo = extractFilePathFromUrl(previewDocument.translated_file_url);
                      if (pathInfo) {
                        const { db } = await import('../../lib/supabase');
                        const success = await db.downloadFileAndTrigger(pathInfo.filePath, previewDocument.filename, pathInfo.bucket);
                        if (!success) {
                          alert('Não foi possível baixar o arquivo. Verifique se você está autenticado.');
                        }
                      }
                    } catch (err) {
                      console.error('Error downloading preview:', err);
                      alert(`Erro ao baixar arquivo: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
                    }
                  }}
                >
                  Download
                </button>
                <button
                  className="px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm bg-white border border-gray-300 rounded hover:bg-gray-50"
                  onClick={() => {
                    if (previewBlobUrl) {
                      window.URL.revokeObjectURL(previewBlobUrl);
                    }
                    setPreviewOpen(false);
                    setPreviewDocument(null);
                    setPreviewUrl(null);
                    setPreviewBlobUrl(null);
                    setPreviewError(null);
                  }}
                >
                  Close
                </button>
              </div>
            </div>
            <div className="flex-1 bg-gray-50 overflow-auto" style={{ 
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-x pan-y pinch-zoom'
            }}>
              {previewLoading && (
                <div className="flex items-center justify-center h-full text-gray-600">
                  <div className="text-center">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    <p className="text-sm sm:text-base">Loading document...</p>
                  </div>
                </div>
              )}
              {!previewLoading && previewError && (
                <div className="p-4 sm:p-6 text-center text-tfe-red-600">
                  <AlertCircle className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2" />
                  <p className="text-sm sm:text-base">{previewError}</p>
                </div>
              )}
              {!previewLoading && !previewError && previewUrl && (
                <>
                  {previewType === 'image' ? (
                    <div className="flex items-center justify-center h-full p-2 sm:p-4" style={{ 
                      minHeight: 'calc(100vh - 60px)',
                      WebkitUserSelect: 'none',
                      userSelect: 'none'
                    }}>
                      <img 
                        src={previewUrl} 
                        alt={previewDocument?.filename || 'Document'} 
                        className="max-w-full max-h-full object-contain"
                        style={{ 
                          maxHeight: 'calc(100vh - 60px)',
                          width: 'auto',
                          height: 'auto',
                          display: 'block'
                        }}
                        draggable={false}
                      />
                    </div>
                  ) : (
                    <div className="w-full h-full" style={{ 
                      minHeight: 'calc(100vh - 60px)',
                      overflow: 'auto',
                      WebkitOverflowScrolling: 'touch'
                    }}>
                      <iframe 
                        src={previewUrl} 
                        className="w-full h-full border-0" 
                        title="Document Preview"
                        style={{
                          minHeight: 'calc(100vh - 60px)',
                          width: '100%',
                          height: '100%'
                        }}
                        scrolling="auto"
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 