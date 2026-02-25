/**
 * HTTP endpoints for category management.
 *
 * 4 endpoints registered under backoffice/categories:
 * - GET    backoffice/categories           (list active categories)
 * - POST   backoffice/categories           (create category)
 * - PUT    backoffice/categories/{id}      (update category)
 * - DELETE backoffice/categories/{id}      (soft delete / deactivate)
 *
 * All endpoints require Admin or SuperAdmin role.
 */
import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from '@azure/functions';
import { getUserFromRequest, requireRole } from '../middleware/auth.js';
import {
  getCategories,
  createCategory,
  updateCategory,
  archiveCategory,
} from '../services/categoryService.js';
import { CategoryInputSchema } from '../models/Category.js';

const isAuthorized = requireRole('Admin', 'SuperAdmin');

/**
 * GET /api/backoffice/categories
 * List all active categories.
 */
async function listCategories(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return { status: 401, jsonBody: { error: 'Not authenticated' } };
    }
    if (!isAuthorized(user)) {
      return {
        status: 403,
        jsonBody: { error: 'Admin or SuperAdmin role required' },
      };
    }

    const categories = await getCategories();
    return { jsonBody: categories };
  } catch (error) {
    context.error('listCategories failed:', error);
    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

/**
 * POST /api/backoffice/categories
 * Create a new category. Validates body with CategoryInputSchema.
 * Returns 201 with the new category's ID.
 */
async function addCategory(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return { status: 401, jsonBody: { error: 'Not authenticated' } };
    }
    if (!isAuthorized(user)) {
      return {
        status: 403,
        jsonBody: { error: 'Admin or SuperAdmin role required' },
      };
    }

    const body = await request.json();
    const parsed = CategoryInputSchema.safeParse(body);
    if (!parsed.success) {
      return {
        status: 400,
        jsonBody: {
          error: 'Validation failed',
          details: parsed.error.flatten(),
        },
      };
    }

    const id = await createCategory(parsed.data);
    return { status: 201, jsonBody: { id } };
  } catch (error) {
    context.error('addCategory failed:', error);
    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

/**
 * PUT /api/backoffice/categories/{id}
 * Update an existing category. Validates body with CategoryInputSchema.
 * Returns 200 on success, 404 if not found.
 */
async function editCategory(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return { status: 401, jsonBody: { error: 'Not authenticated' } };
    }
    if (!isAuthorized(user)) {
      return {
        status: 403,
        jsonBody: { error: 'Admin or SuperAdmin role required' },
      };
    }

    const id = parseInt(request.params.id, 10);
    if (isNaN(id)) {
      return { status: 400, jsonBody: { error: 'Invalid category ID' } };
    }

    const body = await request.json();
    const parsed = CategoryInputSchema.safeParse(body);
    if (!parsed.success) {
      return {
        status: 400,
        jsonBody: {
          error: 'Validation failed',
          details: parsed.error.flatten(),
        },
      };
    }

    const updated = await updateCategory(id, parsed.data);
    if (!updated) {
      return { status: 404, jsonBody: { error: 'Category not found' } };
    }

    return { jsonBody: { success: true } };
  } catch (error) {
    context.error('editCategory failed:', error);
    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

/**
 * DELETE /api/backoffice/categories/{id}
 * Soft delete (deactivate) a category. Sets isActive=0.
 * Returns 200 on success, 404 if not found.
 */
async function removeCategory(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return { status: 401, jsonBody: { error: 'Not authenticated' } };
    }
    if (!isAuthorized(user)) {
      return {
        status: 403,
        jsonBody: { error: 'Admin or SuperAdmin role required' },
      };
    }

    const id = parseInt(request.params.id, 10);
    if (isNaN(id)) {
      return { status: 400, jsonBody: { error: 'Invalid category ID' } };
    }

    const archived = await archiveCategory(id);
    if (!archived) {
      return { status: 404, jsonBody: { error: 'Category not found' } };
    }

    return { jsonBody: { success: true } };
  } catch (error) {
    context.error('removeCategory failed:', error);
    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

/**
 * GET /api/categories
 * Public read-only endpoint for all authenticated users.
 * Returns active categories.
 */
async function listCategoriesPublic(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return { status: 401, jsonBody: { error: 'Not authenticated' } };
    }

    const categories = await getCategories();
    return { jsonBody: categories };
  } catch (error) {
    context.error('listCategoriesPublic failed:', error);
    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

// Register all category endpoints
app.http('listCategoriesPublic', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'categories',
  handler: listCategoriesPublic,
});

app.http('listCategories', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'backoffice/categories',
  handler: listCategories,
});

app.http('addCategory', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'backoffice/categories',
  handler: addCategory,
});

app.http('editCategory', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'backoffice/categories/{id}',
  handler: editCategory,
});

app.http('removeCategory', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'backoffice/categories/{id}',
  handler: removeCategory,
});
