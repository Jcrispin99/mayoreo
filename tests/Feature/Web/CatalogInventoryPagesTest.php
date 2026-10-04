<?php

declare(strict_types=1);

use App\Models\ProductTemplate;
use App\Models\User;
use Illuminate\Contracts\Http\Kernel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful;

uses(RefreshDatabase::class);

it('lets the web session authenticate against the api like a sanctum spa', function (): void {
    /** @var Illuminate\Foundation\Http\Kernel $kernel */
    $kernel = app(Kernel::class);

    expect($kernel->getMiddlewareGroups()['api'])
        ->toContain(EnsureFrontendRequestsAreStateful::class);
});

it('keeps catalog and inventory pages behind login', function (string $url): void {
    $this->get($url)->assertRedirect('/login');
})->with([
    '/catalog/products',
    '/catalog/units',
    '/inventory/stock',
    '/inventory/movements',
    '/inventory/locations',
]);

it('protects each page with the same permission the api uses', function (string $url): void {
    $this->actingAs(User::factory()->create())
        ->get($url)
        ->assertForbidden();
})->with([
    '/catalog/products',
    '/catalog/products/create',
    '/catalog/units',
    '/inventory/stock',
    '/inventory/movements',
    '/inventory/locations',
]);

it('renders the catalog and inventory pages for permitted users', function (string $url, string $permission, string $component): void {
    $user = User::factory()->create();
    grantApiPermissions($user, $permission);

    $this->actingAs($user)
        ->get($url)
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component($component));
})->with([
    ['/catalog/products', 'products.view', 'catalog/products/index'],
    ['/catalog/units', 'products.view', 'catalog/units/index'],
    ['/inventory/stock', 'stock.view', 'inventory/stock/index'],
    ['/inventory/movements', 'stock.view', 'inventory/movements/index'],
    ['/inventory/locations', 'stores.view', 'inventory/locations/index'],
]);

it('only lets product managers open the new product form', function (): void {
    $viewer = User::factory()->create();
    grantApiPermissions($viewer, 'products.view');
    $manager = User::factory()->create();
    grantApiPermissions($manager, 'products.view', 'products.manage');

    $this->actingAs($viewer)->get('/catalog/products/create')->assertForbidden();

    $this->actingAs($manager)
        ->get('/catalog/products/create')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('catalog/products/edit')
            ->where('templateId', null));
});

it('opens an existing product and returns 404 for unknown ones', function (): void {
    $user = User::factory()->create();
    grantApiPermissions($user, 'products.view');
    $template = ProductTemplate::query()->create([
        'name' => 'Harina de maca',
        'is_active' => true,
        'is_pos_visible' => true,
    ]);

    $this->actingAs($user)
        ->get("/catalog/products/{$template->id}")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('catalog/products/edit')
            ->where('templateId', $template->id));

    $this->actingAs($user)->get('/catalog/products/999999')->assertNotFound();
});
