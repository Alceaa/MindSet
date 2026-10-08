package media

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

var ErrNotConfigured = errors.New("media storage is not configured")

type Config struct {
	Endpoint   string
	Region     string
	AccessKey  string
	SecretKey  string
	Bucket     string
	PublicBase string
}

const defaultRegion = "ru-1"

type store struct {
	client *s3.PresignClient
	bucket string
	public string
}

var instance *store

func Setup(cfg Config) error {
	if strings.TrimSpace(cfg.AccessKey) == "" ||
		strings.TrimSpace(cfg.SecretKey) == "" ||
		strings.TrimSpace(cfg.Bucket) == "" {
		return ErrNotConfigured
	}

	endpoint := strings.TrimSpace(cfg.Endpoint)
	if endpoint == "" {
		return ErrNotConfigured
	}

	region := strings.TrimSpace(cfg.Region)
	if region == "" {
		region = defaultRegion
	}

	awsCfg := aws.Config{
		Region:      region,
		Credentials: credentials.NewStaticCredentialsProvider(cfg.AccessKey, cfg.SecretKey, ""),
	}

	client := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		o.BaseEndpoint = aws.String(endpoint)
		o.UsePathStyle = true
	})

	instance = &store{
		client: s3.NewPresignClient(client),
		bucket: cfg.Bucket,
		public: strings.TrimRight(strings.TrimSpace(cfg.PublicBase), "/"),
	}
	return nil
}

func Enabled() bool { return instance != nil }

func PresignPut(ctx context.Context, key string, ttl time.Duration) (string, error) {
	if instance == nil {
		return "", ErrNotConfigured
	}

	out, err := instance.client.PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket: aws.String(instance.bucket),
		Key:    aws.String(key),
	}, s3.WithPresignExpires(ttl))
	if err != nil {
		return "", fmt.Errorf("presign put: %w", err)
	}
	return out.URL, nil
}

func PublicURL(key string) string {
	if instance == nil || instance.public == "" {
		return key
	}
	return instance.public + "/" + strings.TrimLeft(key, "/")
}
