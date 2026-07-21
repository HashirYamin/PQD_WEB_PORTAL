import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CheckSquare2,
  Pencil,
  Plus,
  Save,
  Search,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import {
  EmptyState,
  LoadingBlock,
  PageHeader,
  StatusBadge,
  WarningBox
} from '../components/Common';

const blank = {
  title: '',
  defaultStatus: 'YES',
  defaultRemark: '',
  isActive: true
};

export default function MasterChecklistPage() {
  const { user, selectedCompanyId, appendCompany } = useAuth();
  const companyReady =
    user.role !== 'SUPER_ADMIN' || Boolean(selectedCompanyId);
  const canManage = ['SUPER_ADMIN', 'COMPANY_ADMIN'].includes(user.role);

  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState(null);

  const load = () => {
    if (!companyReady) {
      setLoading(false);
      return;
    }

    setLoading(true);
    api
      .get(appendCompany('/checklists/master'))
      .then(({ data }) => setItems(data.items || []))
      .finally(() => setLoading(false));
  };

  useEffect(load, [selectedCompanyId]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;

    return items.filter((item) =>
      [item.title, item.defaultStatus, item.defaultRemark]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [items, search]);

  const openCreate = () => {
    setEditingId(null);
    setForm(blank);
    setOpen(true);
  };

  const openEdit = (item) => {
    setEditingId(item.id);
    setForm({
      title: item.title,
      defaultStatus: item.defaultStatus || 'YES',
      defaultRemark: item.defaultRemark || '',
      isActive: Boolean(item.isActive)
    });
    setOpen(true);
  };

  const save = async (event) => {
    event.preventDefault();

    try {
      if (editingId) {
        await api.put(
          appendCompany(`/checklists/master/${editingId}`),
          form
        );
      } else {
        await api.post('/checklists/master', {
          ...form,
          companyId: selectedCompanyId || undefined
        });
      }

      toast.success(
        editingId ? 'Checklist item updated' : 'Checklist item added'
      );
      setOpen(false);
      load();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          'Could not save checklist item'
      );
    }
  };

  const toggle = async (item) => {
    try {
      await api.put(
        appendCompany(`/checklists/master/${item.id}`),
        { isActive: !item.isActive }
      );
      toast.success(item.isActive ? 'Item deactivated' : 'Item activated');
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Update failed');
    }
  };

  const move = async (originalIndex, direction) => {
    const target = originalIndex + direction;
    if (target < 0 || target >= items.length) return;

    const next = [...items];
    [next[originalIndex], next[target]] = [
      next[target],
      next[originalIndex]
    ];
    setItems(next);

    try {
      await api.post('/checklists/master/reorder', {
        ids: next.map((item) => item.id),
        companyId: selectedCompanyId || undefined
      });
    } catch (error) {
      toast.error(
        error.response?.data?.message || 'Could not update order'
      );
      load();
    }
  };

  if (!companyReady) {
    return (
      <WarningBox title="Select a company">
        Choose a company before managing its Master Checklist.
      </WarningBox>
    );
  }

  return (
    <>
      <PageHeader
        title="Master Checklist"
        description="Search and manage the company-level source list of all possible requirements."
        actions={
          canManage && (
            <button className="primary-button" onClick={openCreate}>
              <Plus size={17} /> Add item
            </button>
          )
        }
      />

      <div className="info-strip">
        <CheckSquare2 size={19} />
        <div>
          <strong>Safe historical behavior</strong>
          <span>
            Editing, reordering or deactivating a Master Checklist item
            does not modify saved Project Checklists or old PQDs.
          </span>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-field">
          <Search size={17} />
          <input
            placeholder="Search checklist item, status or remark…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <span className="count-pill">
          {filteredItems.length} of {items.length} items
        </span>
      </div>

      {loading ? (
        <LoadingBlock />
      ) : !filteredItems.length ? (
        <EmptyState
          title={
            search
              ? 'No checklist items match your search'
              : 'No Master Checklist items'
          }
          description={
            search
              ? 'Try another title, status or remark.'
              : 'Add the first checklist requirement.'
          }
        />
      ) : (
        <div className="table-card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>SN</th>
                  <th>Checklist Item</th>
                  <th>Default Status</th>
                  <th>Default Remark</th>
                  <th>State</th>
                  <th>Controls</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const originalIndex = items.findIndex(
                    (row) => row.id === item.id
                  );

                  return (
                    <tr
                      key={item.id}
                      className={!item.isActive ? 'row-muted' : ''}
                    >
                      <td>{originalIndex + 1}</td>
                      <td>
                        <strong>{item.title}</strong>
                      </td>
                      <td>
                        <StatusBadge
                          status={item.defaultStatus || 'YES'}
                        />
                      </td>
                      <td>{item.defaultRemark || '—'}</td>
                      <td>
                        <StatusBadge
                          status={item.isActive ? 'ACTIVE' : 'INACTIVE'}
                        />
                      </td>
                      <td>
                        {canManage ? (
                          <div className="row-actions">
                            <button
                              className="icon-button"
                              onClick={() => move(originalIndex, -1)}
                              disabled={Boolean(search) || originalIndex === 0}
                              title={
                                search
                                  ? 'Clear search before reordering'
                                  : 'Move up'
                              }
                            >
                              <ArrowUp size={16} />
                            </button>
                            <button
                              className="icon-button"
                              onClick={() => move(originalIndex, 1)}
                              disabled={
                                Boolean(search) ||
                                originalIndex === items.length - 1
                              }
                              title={
                                search
                                  ? 'Clear search before reordering'
                                  : 'Move down'
                              }
                            >
                              <ArrowDown size={16} />
                            </button>
                            <button
                              className="icon-button"
                              onClick={() => openEdit(item)}
                              title="Edit item"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              className="icon-button"
                              onClick={() => toggle(item)}
                              title={item.isActive ? 'Deactivate' : 'Activate'}
                            >
                              {item.isActive ? (
                                <ToggleRight size={19} />
                              ) : (
                                <ToggleLeft size={19} />
                              )}
                            </button>
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={open}
        title={
          editingId
            ? 'Edit Master Checklist Item'
            : 'Add Master Checklist Item'
        }
        onClose={() => setOpen(false)}
      >
        <form className="form-grid two" onSubmit={save}>
          <label className="span-2">
            Checklist item
            <textarea
              rows="3"
              value={form.title}
              onChange={(event) =>
                setForm({ ...form, title: event.target.value })
              }
              required
            />
          </label>

          <label>
            Default status
            <select
              value={form.defaultStatus}
              onChange={(event) =>
                setForm({ ...form, defaultStatus: event.target.value })
              }
            >
              <option>YES</option>
              <option>NO</option>
              <option>NA</option>
              <option>As Required</option>
              <option>UNDER REVIEW</option>
              <option>APPROVED</option>
              <option>NOT SUBMITTED</option>
            </select>
          </label>

          <label>
            Active
            <select
              value={String(form.isActive)}
              onChange={(event) =>
                setForm({
                  ...form,
                  isActive: event.target.value === 'true'
                })
              }
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </label>

          <label className="span-2">
            Default remark
            <textarea
              rows="3"
              value={form.defaultRemark}
              onChange={(event) =>
                setForm({ ...form, defaultRemark: event.target.value })
              }
              placeholder="Leave empty for no remarks"
            />
          </label>

          <div className="form-actions span-2">
            <button className="primary-button">
              <Save size={17} /> Save item
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
