---
title: Go Types
description: Программное управление ресурсами Cozystack с помощью типов Go
weight: 2
---

## Типы Go

Cozystack публикует свои типы ресурсов Kubernetes в виде Go-модуля, что позволяет управлять ресурсами Cozystack из любого Go-кода. Типы доступны по адресу [pkg.go.dev/github.com/cozystack/cozystack/api/apps/v1alpha1](https://pkg.go.dev/github.com/cozystack/cozystack/api/apps/v1alpha1).

## Установка

Добавьте зависимость в ваш Go-модуль:

```bash
go get github.com/cozystack/cozystack/api/apps/v1alpha1@{{< version-pin "cozystack_tag" >}}
```

## Сценарии использования

Типы Go полезны для:

- **Создания инструментов автоматизации** — разработки скриптов или приложений, программно развёртывающих ресурсы Cozystack и управляющих ими
- **Интеграции с внешними системами** — подключения Cozystack к собственным CI/CD-конвейерам, системам мониторинга или оркестрации
- **Валидации конфигураций** — проверки спецификаций ресурсов перед их применением к кластеру
- **Генерации документации** — разбора и анализа существующих ресурсов Cozystack
- **Создания дашбордов** — разработки пользовательских интерфейсов для управления Cozystack

## Доступные пакеты

Модуль содержит пакеты для каждого типа ресурса; вы можете изучить их для вашей конкретной версии по адресу [pkg.go.dev/github.com/cozystack/cozystack/api/apps/v1alpha1](https://pkg.go.dev/github.com/cozystack/cozystack/api/apps/v1alpha1)

### Простой пример

Для базового использования достаточно импортировать нужный пакет:

```go
package main

import (
	"fmt"

	"github.com/cozystack/cozystack/api/apps/v1alpha1/vmdisk"
)

func main() {
	// Создание источника VMDisk из именованного образа
	image := vmdisk.SourceImage{Name: "ubuntu"}
	fmt.Printf("Source: %+v\n", image)
}
```

## Сложный пример

Этот пример демонстрирует создание и маршалинг нескольких типов ресурсов Cozystack:

```go
package main

import (
	"encoding/json"
	"fmt"

	"github.com/cozystack/cozystack/api/apps/v1alpha1/postgresql"
	"github.com/cozystack/cozystack/api/apps/v1alpha1/vminstance"
	"github.com/cozystack/cozystack/api/apps/v1alpha1/redis"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/api/resource"
)

func main() {
	// Создание конфигурации PostgreSQL с пользователями и базами данных
	pgConfig := postgresql.Config{
		TypeMeta: metav1.TypeMeta{
			APIVersion: "apps.cozystack.io/v1alpha1",
			Kind:       "Postgres",
		},
		ObjectMeta: metav1.ObjectMeta{
			Name:      "my-app-db",
			Namespace: "tenant-myapp",
		},
		Spec: postgresql.ConfigSpec{
			Replicas: 3,
			Size:     resource.MustParse("50Gi"),
			Version:  postgresql.Version("v18"),
			Users: map[string]postgresql.User{
				"appuser": {
					Password:   "secretpassword",
					Replication: false,
				},
				"readonly": {
					Password: "readonlypass",
				},
			},
			Databases: map[string]postgresql.Database{
				"myapp": {
					Extensions: []string{"pg_trgm", "uuid-ossp"},
					Roles: postgresql.DatabaseRoles{
						Admin:    []string{"appuser"},
						Readonly: []string{"readonly"},
					},
				},
			},
			Backup: postgresql.Backup{
				Enabled:         true,
				DestinationPath: "s3://mybackups/postgres/",
				EndpointURL:     "http://minio:9000",
				RetentionPolicy: "30d",
				S3AccessKey:     "myaccesskey",
				S3SecretKey:     "mysecretkey",
				Schedule:        "0 2 * * * *",
			},
			Quorum: postgresql.Quorum{
				MinSyncReplicas: 1,
				MaxSyncReplicas: 1,
			},
			Postgresql: postgresql.PostgreSQL{
				Parameters: postgresql.PostgreSQLParameters{
					MaxConnections: 200,
				},
			},
		},
	}

	// Маршалинг в JSON для kubectl apply
	pgJSON, _ := json.MarshalIndent(pgConfig, "", "  ")
	fmt.Println(string(pgJSON))

	// Создание конфигурации Redis
	redisConfig := redis.Config{
		TypeMeta: metav1.TypeMeta{
			APIVersion: "apps.cozystack.io/v1alpha1",
			Kind:       "Redis",
		},
		ObjectMeta: metav1.ObjectMeta{
			Name:      "cache",
			Namespace: "tenant-myapp",
		},
		Spec: redis.ConfigSpec{
			Replicas:        2,
			Size:            resource.MustParse("5Gi"),
			Version:         redis.Version("v8"),
			AuthEnabled:     true,
			ResourcesPreset: redis.ResourcesPreset("medium"),
		},
	}

	// Создание VMInstance с дисками
	vmConfig := vminstance.Config{
		TypeMeta: metav1.TypeMeta{
			APIVersion: "apps.cozystack.io/v1alpha1",
			Kind:       "VMInstance",
		},
		ObjectMeta: metav1.ObjectMeta{
			Name:      "my-vm",
			Namespace: "tenant-myapp",
		},
		Spec: vminstance.ConfigSpec{
			InstanceType:    "u1.medium",
			InstanceProfile: "ubuntu",
			RunStrategy:     vminstance.RunStrategy("Always"),
			External:        true,
			ExternalMethod:  vminstance.ExternalMethod("PortList"),
			ExternalPorts:   []int{22, 80, 443},
			Resources: vminstance.Resources{
				Cpu:     resource.MustParse("2"),
				Memory:  resource.MustParse("4Gi"),
				Sockets: resource.MustParse("1"),
			},
			Disks: []vminstance.Disk{
				{Bus: "sata", Name: "rootdisk"},
				{Bus: "sata", Name: "datadisk"},
			},
			Subnets: []vminstance.Subnet{
				{Name: "default"},
			},
			SshKeys: []string{
				"ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQ...",
			},
			CloudInit: `#cloud-config
packages:
  - nginx`,
		},
	}
}
```

## Развёртывание ресурсов

После создания конфигураций ресурсов их можно развернуть с помощью:

1. **kubectl** — маршалинг в YAML и применение:
   ```go
   yamlData, _ := json.Marshal(yourConfig)
   // Используйте библиотеку маршалинга YAML для конвертации в YAML
   ```

2. **Прямой клиент Kubernetes** — использование client-go:
   ```go
   import (
     "k8s.io/client-go/kubernetes"
     "k8s.io/apimachinery/pkg/runtime"
   )

   scheme := runtime.NewScheme()
   // Зарегистрируйте ваши типы в схеме
   ```

## Дополнительные ресурсы

- [Документация Go-пакета](https://pkg.go.dev/github.com/cozystack/cozystack/api/apps/v1alpha1)
- [Репозиторий Cozystack на GitHub](https://github.com/cozystack/cozystack)
- [Справочник Kubernetes API](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.35/)
