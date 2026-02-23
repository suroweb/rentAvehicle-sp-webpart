import * as React from 'react';
import { PrimaryButton, DefaultButton, IconButton } from '@fluentui/react/lib/Button';
import { TextField } from '@fluentui/react/lib/TextField';
import {
  DetailsList,
  DetailsListLayoutMode,
  SelectionMode,
  IColumn,
} from '@fluentui/react/lib/DetailsList';
import { Spinner, SpinnerSize } from '@fluentui/react/lib/Spinner';
import { MessageBar, MessageBarType } from '@fluentui/react/lib/MessageBar';
import styles from './CategoryManagement.module.scss';
import { ApiService } from '../../services/ApiService';
import { ICategory, ICategoryInput } from '../../models/ICategory';
import { ConfirmDialog } from '../ConfirmDialog/ConfirmDialog';

export interface ICategoryManagementProps {
  apiService: ApiService;
}

interface IFormState {
  name: string;
  description: string;
}

const emptyForm: IFormState = { name: '', description: '' };

export const CategoryManagement: React.FC<ICategoryManagementProps> = ({ apiService }) => {
  const [categories, setCategories] = React.useState<ICategory[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | undefined>(undefined);
  const [successMessage, setSuccessMessage] = React.useState<string | undefined>(undefined);

  // Inline form state
  const [showAddForm, setShowAddForm] = React.useState<boolean>(false);
  const [addForm, setAddForm] = React.useState<IFormState>(emptyForm);
  const [addFormErrors, setAddFormErrors] = React.useState<{ name?: string }>({});
  const [saving, setSaving] = React.useState<boolean>(false);

  // Inline edit state
  const [editingId, setEditingId] = React.useState<number | undefined>(undefined);
  const [editForm, setEditForm] = React.useState<IFormState>(emptyForm);
  const [editFormErrors, setEditFormErrors] = React.useState<{ name?: string }>({});

  // Confirm dialog state
  const [confirmState, setConfirmState] = React.useState<{
    hidden: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  }>({
    hidden: true,
    title: '',
    message: '',
    confirmLabel: 'Confirm',
    onConfirm: () => undefined,
  });

  const fetchCategories = React.useCallback(async (): Promise<void> => {
    try {
      const data = await apiService.getCategories();
      setCategories(data);
      setError(undefined);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load categories';
      setError(message);
    }
  }, [apiService]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchCategories()
      .then(() => {
        if (!cancelled) setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchCategories]);

  const validateForm = (form: IFormState): { name?: string } => {
    const errs: { name?: string } = {};
    if (!form.name.trim()) {
      errs.name = 'Category name is required';
    } else if (form.name.trim().length > 100) {
      errs.name = 'Category name must be 100 characters or less';
    }
    return errs;
  };

  const handleAddSubmit = React.useCallback(async (): Promise<void> => {
    const errs = validateForm(addForm);
    if (Object.keys(errs).length > 0) {
      setAddFormErrors(errs);
      return;
    }

    setSaving(true);
    setError(undefined);

    const input: ICategoryInput = {
      name: addForm.name.trim(),
      description: addForm.description.trim() || undefined,
    };

    try {
      await apiService.createCategory(input);
      setShowAddForm(false);
      setAddForm(emptyForm);
      setAddFormErrors({});
      setSuccessMessage(`Category "${input.name}" created successfully.`);
      await fetchCategories();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create category';
      setError(message);
    } finally {
      setSaving(false);
    }
  }, [addForm, apiService, fetchCategories]);

  const handleEditStart = React.useCallback((category: ICategory): void => {
    setEditingId(category.id);
    setEditForm({ name: category.name, description: category.description || '' });
    setEditFormErrors({});
  }, []);

  const handleEditSubmit = React.useCallback(async (): Promise<void> => {
    if (editingId === undefined) return;

    const errs = validateForm(editForm);
    if (Object.keys(errs).length > 0) {
      setEditFormErrors(errs);
      return;
    }

    setSaving(true);
    setError(undefined);

    const input: ICategoryInput = {
      name: editForm.name.trim(),
      description: editForm.description.trim() || undefined,
    };

    try {
      await apiService.updateCategory(editingId, input);
      setEditingId(undefined);
      setEditForm(emptyForm);
      setEditFormErrors({});
      setSuccessMessage(`Category "${input.name}" updated successfully.`);
      await fetchCategories();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update category';
      setError(message);
    } finally {
      setSaving(false);
    }
  }, [editingId, editForm, apiService, fetchCategories]);

  const handleEditCancel = React.useCallback((): void => {
    setEditingId(undefined);
    setEditForm(emptyForm);
    setEditFormErrors({});
  }, []);

  const handleDeactivate = React.useCallback(
    (category: ICategory): void => {
      setConfirmState({
        hidden: false,
        title: 'Deactivate Category',
        message: `This will deactivate the category "${category.name}". Vehicles in this category will remain but the category won't be available for new vehicles.`,
        confirmLabel: 'Deactivate',
        onConfirm: () => {
          apiService
            .deleteCategory(category.id)
            .then(() => {
              setSuccessMessage(`Category "${category.name}" deactivated.`);
              return fetchCategories();
            })
            .then(() => {
              setConfirmState((prev) => ({ ...prev, hidden: true }));
            })
            .catch((err: Error) => {
              setError(err.message || 'Failed to deactivate category');
              setConfirmState((prev) => ({ ...prev, hidden: true }));
            });
        },
      });
    },
    [apiService, fetchCategories]
  );

  const handleDismissConfirm = React.useCallback((): void => {
    setConfirmState((prev) => ({ ...prev, hidden: true }));
  }, []);

  const columns: IColumn[] = React.useMemo(
    () => [
      {
        key: 'name',
        name: 'Name',
        fieldName: 'name',
        minWidth: 150,
        maxWidth: 250,
        isResizable: true,
        onRender: (item: ICategory) => {
          if (editingId === item.id) {
            return (
              <TextField
                value={editForm.name}
                onChange={(_e, val) => {
                  setEditForm((prev) => ({ ...prev, name: val || '' }));
                  setEditFormErrors({});
                }}
                errorMessage={editFormErrors.name}
                styles={{ root: { minWidth: 120 } }}
                disabled={saving}
              />
            );
          }
          return (
            <span
              style={{
                fontWeight: !item.isActive ? 400 : 600,
                color: !item.isActive ? '#a19f9d' : '#323130',
              }}
            >
              {item.name}
              {!item.isActive && (
                <span style={{ fontSize: 11, color: '#a19f9d', marginLeft: 8 }}>(inactive)</span>
              )}
            </span>
          );
        },
      },
      {
        key: 'description',
        name: 'Description',
        fieldName: 'description',
        minWidth: 200,
        maxWidth: 400,
        isResizable: true,
        onRender: (item: ICategory) => {
          if (editingId === item.id) {
            return (
              <TextField
                value={editForm.description}
                onChange={(_e, val) =>
                  setEditForm((prev) => ({ ...prev, description: val || '' }))
                }
                styles={{ root: { minWidth: 150 } }}
                disabled={saving}
              />
            );
          }
          return (
            <span style={{ color: !item.isActive ? '#a19f9d' : '#605e5c' }}>
              {item.description || '--'}
            </span>
          );
        },
      },
      {
        key: 'actions',
        name: 'Actions',
        minWidth: 100,
        maxWidth: 120,
        onRender: (item: ICategory) => {
          if (editingId === item.id) {
            return (
              <div style={{ display: 'flex', gap: 4 }}>
                <IconButton
                  iconProps={{ iconName: 'CheckMark' }}
                  title="Save"
                  ariaLabel="Save changes"
                  onClick={handleEditSubmit}
                  disabled={saving}
                />
                <IconButton
                  iconProps={{ iconName: 'Cancel' }}
                  title="Cancel"
                  ariaLabel="Cancel editing"
                  onClick={handleEditCancel}
                  disabled={saving}
                />
              </div>
            );
          }
          return (
            <div style={{ display: 'flex', gap: 4 }}>
              {item.isActive && (
                <>
                  <IconButton
                    iconProps={{ iconName: 'Edit' }}
                    title="Edit"
                    ariaLabel={`Edit ${item.name}`}
                    onClick={() => handleEditStart(item)}
                  />
                  <IconButton
                    iconProps={{ iconName: 'StatusCircleBlock' }}
                    title="Deactivate"
                    ariaLabel={`Deactivate ${item.name}`}
                    onClick={() => handleDeactivate(item)}
                  />
                </>
              )}
            </div>
          );
        },
      },
    ],
    [
      editingId,
      editForm,
      editFormErrors,
      saving,
      handleEditSubmit,
      handleEditCancel,
      handleEditStart,
      handleDeactivate,
    ]
  );

  if (loading) {
    return (
      <div className={styles.categoryManagement}>
        <div className={styles.loadingContainer}>
          <Spinner size={SpinnerSize.large} label="Loading categories..." />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.categoryManagement}>
      <div className={styles.header}>
        <h2 className={styles.pageTitle}>Vehicle Categories</h2>
        {!showAddForm && (
          <PrimaryButton
            text="Add Category"
            iconProps={{ iconName: 'Add' }}
            onClick={() => {
              setShowAddForm(true);
              setAddForm(emptyForm);
              setAddFormErrors({});
              setSuccessMessage(undefined);
            }}
          />
        )}
      </div>

      {error && (
        <MessageBar
          messageBarType={MessageBarType.error}
          isMultiline={false}
          onDismiss={() => setError(undefined)}
          dismissButtonAriaLabel="Close"
          styles={{ root: { marginBottom: 12 } }}
        >
          {error}
        </MessageBar>
      )}

      {successMessage && (
        <MessageBar
          messageBarType={MessageBarType.success}
          isMultiline={false}
          onDismiss={() => setSuccessMessage(undefined)}
          dismissButtonAriaLabel="Close"
          styles={{ root: { marginBottom: 12 } }}
        >
          {successMessage}
        </MessageBar>
      )}

      {/* Inline add form */}
      {showAddForm && (
        <div className={styles.addForm}>
          <div className={styles.addFormFields}>
            <TextField
              label="Category Name"
              required
              value={addForm.name}
              onChange={(_e, val) => {
                setAddForm((prev) => ({ ...prev, name: val || '' }));
                setAddFormErrors({});
              }}
              errorMessage={addFormErrors.name}
              maxLength={100}
              placeholder="e.g. SUV, Sedan, Van"
              disabled={saving}
            />
            <TextField
              label="Description"
              value={addForm.description}
              onChange={(_e, val) =>
                setAddForm((prev) => ({ ...prev, description: val || '' }))
              }
              maxLength={500}
              placeholder="Optional description"
              disabled={saving}
            />
          </div>
          <div className={styles.addFormActions}>
            {saving ? (
              <Spinner size={SpinnerSize.small} label="Saving..." />
            ) : (
              <>
                <PrimaryButton text="Create" onClick={handleAddSubmit} />
                <DefaultButton
                  text="Cancel"
                  onClick={() => {
                    setShowAddForm(false);
                    setAddForm(emptyForm);
                    setAddFormErrors({});
                  }}
                />
              </>
            )}
          </div>
        </div>
      )}

      {/* Categories list */}
      <div className={styles.tableContainer}>
        {categories.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyStateText}>
              No categories defined yet. Add a category to get started.
            </p>
          </div>
        ) : (
          <DetailsList
            items={categories}
            columns={columns}
            selectionMode={SelectionMode.none}
            layoutMode={DetailsListLayoutMode.justified}
            isHeaderVisible={true}
          />
        )}
      </div>

      <ConfirmDialog
        hidden={confirmState.hidden}
        title={confirmState.title}
        message={confirmState.message}
        confirmLabel={confirmState.confirmLabel}
        onConfirm={confirmState.onConfirm}
        onDismiss={handleDismissConfirm}
      />
    </div>
  );
};
